#!/usr/bin/env python3
"""Verify the actual WebSocket/RFB frame path; never infer Android health from HTTP."""
import argparse, hashlib, json, struct
from pathlib import Path
import websocket
from PIL import Image
p=argparse.ArgumentParser()
p.add_argument("--url", default="ws://127.0.0.1:18080/websockify")
p.add_argument("--output", required=True)
p.add_argument("--click", nargs=2, type=int)
a=p.parse_args()
w=websocket.create_connection(a.url, subprotocols=["binary"], timeout=25)
buf=bytearray()
def read(n):
    while len(buf)<n:
        part=w.recv()
        if not isinstance(part,bytes) or not part: raise RuntimeError("RFB stream closed")
        buf.extend(part)
    data=bytes(buf[:n]); del buf[:n]; return data
def send(b): w.send_binary(b)
assert read(12)==b"RFB 003.008\n"
send(b"RFB 003.008\n")
n=read(1)[0]
assert n>0 and 1 in read(n), "Expected SSH-protected local RFB"
send(b"\x01")
assert read(4)==b"\0\0\0\0"
send(b"\x01")
header=read(24)
width,height=struct.unpack(">HH",header[:4])
assert 0<width<=8192 and 0<height<=8192
name=read(struct.unpack(">I",header[20:])[0]).decode(errors="replace")
send(b"\x00\0\0\0"+struct.pack(">BBBBHHHBBBxxx",32,24,0,1,255,255,255,16,8,0))
send(struct.pack(">BBHi",2,0,1,0))
if a.click:
    x,y=a.click
    assert 0<=x<width and 0<=y<height
    send(struct.pack(">BBHH",5,1,x,y)); send(struct.pack(">BBHH",5,0,x,y))
send(struct.pack(">BBHHHH",3,0,0,0,width,height))
screen=Image.new("RGB",(width,height))
rectangles=0
while not rectangles:
    t=read(1)[0]
    if t==0:
        count=struct.unpack(">xH",read(3))[0]
        for _ in range(count):
            x,y,rw,rh,enc=struct.unpack(">HHHHi",read(12))
            assert enc==0 and x+rw<=width and y+rh<=height
            raw=read(rw*rh*4)
            screen.paste(Image.frombytes("RGB",(rw,rh),raw,"raw","BGRX"),(x,y))
            rectangles+=1
    elif t==2: continue
    elif t==3:
        size=struct.unpack(">xxxI",read(7))[0]
        assert size<=1048576
        read(size)
    else: raise RuntimeError("Unexpected RFB message "+str(t))
out=Path(a.output);out.parent.mkdir(parents=True,exist_ok=True);screen.save(out)
print(json.dumps({"status":"PASS","frame":[width,height],"rectangles":rectangles,"sha256":hashlib.sha256(out.read_bytes()).hexdigest(),"output":str(out)}))
w.close()
