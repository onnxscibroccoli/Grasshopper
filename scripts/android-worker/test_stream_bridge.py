"""Catch lost binary data, hung viewer disconnects, and accepted text frames."""
import importlib.util
import queue
import socket
import threading
import unittest
from pathlib import Path
import websocket

class Peer:
    def __init__(self):
        self.incoming = queue.Queue()
        self.sent = queue.Queue()
        self.closed = threading.Event()
    def recv(self):
        try:
            return self.incoming.get(timeout=0.05)
        except queue.Empty:
            raise websocket.WebSocketTimeoutException()
    def send_binary(self, data):
        self.sent.put(data)
    def close(self):
        self.closed.set()

class StreamBridgeTests(unittest.TestCase):
    def setUp(self):
        path = Path(__file__).with_name("stream_bridge.py")
        self.assertTrue(path.exists(), "Android stream bridge is missing")
        spec = importlib.util.spec_from_file_location("stream_bridge", path)
        self.module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(self.module)
        self.client, self.server = socket.socketpair()
        self.client.settimeout(2)
        self.peer = Peer()
        self.worker = threading.Thread(
            target=self.module.bridge, args=(self.server, self.peer), daemon=True)
        self.worker.start()
    def tearDown(self):
        self.client.close()
        self.peer.incoming.put(b"")
        self.worker.join(2)
        self.server.close()
    def test_binary_data_crosses_both_directions(self):
        self.peer.incoming.put(b"RFB 003.008\n")
        self.assertEqual(self.client.recv(12), b"RFB 003.008\n")
        self.client.sendall(b"\x00\xff\x01")
        self.assertEqual(self.peer.sent.get(timeout=2), b"\x00\xff\x01")
    def test_viewer_disconnect_closes_only_its_upstream(self):
        self.client.close()
        self.worker.join(2)
        self.assertFalse(self.worker.is_alive())
        self.assertTrue(self.peer.closed.is_set())
    def test_upstream_disconnect_closes_viewer(self):
        self.peer.incoming.put(b"")
        self.assertEqual(self.client.recv(1), b"")
        self.worker.join(2)
        self.assertFalse(self.worker.is_alive())
    def test_text_frames_are_rejected(self):
        self.peer.incoming.put("unexpected text")
        self.assertEqual(self.client.recv(1), b"")
        self.worker.join(2)
        self.assertFalse(self.worker.is_alive())

if __name__ == "__main__":
    unittest.main()
