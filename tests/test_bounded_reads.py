"""Tiny files do not allocate the configured maximum; growth cannot hide."""
import builtins

import pytest

from scanner.limits import read_bytes


@pytest.mark.parametrize("grow", [False, True])
def test_small_read_allocation_and_growth_detection(tmp_path, monkeypatch, grow):
    path = tmp_path / "small.txt"
    path.write_bytes(b"abc")
    original = builtins.open
    requests = []
    class Reader:
        def __enter__(self):
            self.stream = original(path, "rb")
            return self
        def __exit__(self, *args):
            self.stream.close()
        def fileno(self):
            return self.stream.fileno()
        def read(self, size):
            requests.append(size)
            return b"abcd" if grow else self.stream.read(size)
    monkeypatch.setenv("ECDAT_MAX_FILE_BYTES", str(128 * 1024 * 1024))
    monkeypatch.setattr(builtins, "open", lambda *args, **kwargs: Reader())
    if grow:
        with pytest.raises(OSError, match="grew"):
            read_bytes(str(path))
    else:
        assert read_bytes(str(path)) == b"abc"
    assert requests == [4]
