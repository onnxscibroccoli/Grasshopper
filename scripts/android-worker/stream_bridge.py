#!/usr/bin/env python3
"""Loopback RFB adapter for an existing private Android WebSocket relay.

A viewer owns one transport connection. Disconnects never control Android
processes or replay input. Access authentication remains at the token gateway.
"""
import argparse
import json
import socket
import socketserver
import threading
import websocket

def bridge(downstream, upstream):
    stopped = threading.Event()
    downstream.settimeout(0.25)
    def receive():
        try:
            while not stopped.is_set():
                try:
                    data = upstream.recv()
                except websocket.WebSocketTimeoutException:
                    continue
                if not data or not isinstance(data, bytes):
                    break
                downstream.sendall(data)
        except (OSError, websocket.WebSocketException):
            pass
        finally:
            stopped.set()
            try:
                downstream.shutdown(socket.SHUT_RDWR)
            except OSError:
                pass
    reader = threading.Thread(target=receive, daemon=True)
    reader.start()
    try:
        while not stopped.is_set():
            try:
                data = downstream.recv(65536)
            except socket.timeout:
                continue
            if not data:
                break
            upstream.send_binary(data)
    except (OSError, websocket.WebSocketException):
        pass
    finally:
        stopped.set()
        upstream.close()
        try:
            downstream.shutdown(socket.SHUT_RDWR)
        except OSError:
            pass
        reader.join(2)

class Server(socketserver.ThreadingTCPServer):
    allow_reuse_address = True
    daemon_threads = True
    slots = threading.BoundedSemaphore(8)

class Handler(socketserver.BaseRequestHandler):
    def handle(self):
        if not self.server.slots.acquire(blocking=False):
            return
        try:
            upstream = websocket.create_connection(
                self.server.upstream, subprotocols=["binary"],
                timeout=10, enable_multithread=True, http_no_proxy=["127.0.0.1"])
            upstream.settimeout(0.25)
            print(json.dumps({"event": "viewer_connected"}), flush=True)
            bridge(self.request, upstream)
        except (OSError, websocket.WebSocketException):
            print(json.dumps({"event": "upstream_unavailable"}), flush=True)
        finally:
            self.server.slots.release()
            print(json.dumps({"event": "viewer_disconnected"}), flush=True)

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=15910)
    parser.add_argument("--upstream-port", type=int, default=16080)
    args = parser.parse_args()
    if not (1024 <= args.port <= 65535 and
            1024 <= args.upstream_port <= 65535):
        parser.error("Ports must be between 1024 and 65535")
    with Server(("127.0.0.1", args.port), Handler) as server:
        server.upstream = "ws://127.0.0.1:%d/websockify" % args.upstream_port
        print(json.dumps({"event": "bridge_ready", "port": args.port}), flush=True)
        server.serve_forever()

if __name__ == "__main__":
    main()
