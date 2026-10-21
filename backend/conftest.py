"""
conftest.py – pytest configuration.
Sets up the sys.path so tests can import from app/.
"""
import sys
import os

# Add the backend/ directory to the path so `from app.xxx import yyy` works
sys.path.insert(0, os.path.dirname(__file__))
