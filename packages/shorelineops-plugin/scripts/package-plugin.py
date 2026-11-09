from pathlib import Path
import json,zipfile,hashlib
root=Path.cwd()
plugin=root/'plugin'
manifest=json.loads((plugin/'plugin.json').read_text(encoding='utf-8'))
legacy=json.loads((plugin/'.codex-plugin/plugin.json').read_text(encoding='utf-8'))
assert manifest['name']==legacy['name']=='sylvia-ross-menu-processor'
assert manifest['version']==legacy['version']==json.loads((root/'package.json').read_text())['version']
assert manifest['$schema']=='https://agent-plugins.org/schemas/1.0.0/plugin.schema.json'
interface=manifest['extensions']['com.openai']['interface']
assert interface==legacy['interface']
assert len(interface['shortDescription'])<=30
assert interface['category']=='Business & Operations'
for filename in ['mcp.json','.mcp.json']:
    config=json.loads((plugin/filename).read_text(encoding='utf-8'))
    assert config['mcpServers']['sylvia-ross']['args']==['${PLUGIN_ROOT}/server.mjs']
assert json.loads((plugin/'fixtures/reviewed/week-1.menu.json').read_text())['approval'] is None
archive=root/'output'/f"sylvia-ross-menu-processor-{manifest['version']}.zip"
files=sorted(file for file in plugin.rglob('*') if file.is_file())
for file in files:
    assert not file.is_symlink()
    assert not any(part in {'node_modules','.git','.env','output'} for part in file.relative_to(plugin).parts)
    if file.suffix=='.json': json.loads(file.read_text(encoding='utf-8'))
with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED) as out:
    for file in files: out.write(file,f"{manifest['name']}/{file.relative_to(plugin).as_posix()}")
with zipfile.ZipFile(archive) as zipped:
    assert zipped.testzip() is None
    assert len(zipped.namelist())==len(files)
    assert all(name.startswith(manifest['name']+'/') for name in zipped.namelist())
    for name in zipped.namelist(): assert '..' not in Path(name).parts
print(json.dumps({'archivePath':str(archive),'files':len(files),'bytes':archive.stat().st_size,'sha256':hashlib.sha256(archive.read_bytes()).hexdigest(),'manifest':'PASS','archiveCheck':'PASS'},indent=2))