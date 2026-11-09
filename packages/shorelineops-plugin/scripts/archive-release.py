from pathlib import Path
import sys,zipfile
source=Path(sys.argv[1]).resolve();output=Path(sys.argv[2]).resolve()
assert source.is_dir() and not output.is_relative_to(source)
with zipfile.ZipFile(output,'w',zipfile.ZIP_DEFLATED) as archive:
 for file in sorted(source.rglob('*')):
  if file.is_file():
   assert not file.is_symlink()
   archive.write(file,file.relative_to(source).as_posix())
with zipfile.ZipFile(output) as archive: assert archive.testzip() is None
