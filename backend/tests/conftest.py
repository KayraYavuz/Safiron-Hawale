"""
Test configuration — add backend/ to sys.path so `app.*` imports work.
Run from backend/: venv/bin/pytest tests/ -v
"""
import sys
import os

# backend/ klasörünü path'e ekle
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
