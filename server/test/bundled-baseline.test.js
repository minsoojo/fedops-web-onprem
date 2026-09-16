import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import {
  getBundledBaselineArtifact,
  getBundledBaselineSession,
  getBundledBaselineTemplate,
} from '../src/lib/bundledBaseline.js';

test('bundled Baseline 0.19.0 keeps Task Data and pins optional evaluation runtime', () => {
  const template = getBundledBaselineTemplate();
  const session = getBundledBaselineSession();

  assert.deepEqual(template, {
    name: 'federated-task-baseline',
    version: '0.19.0',
    revision: 1,
  });
  assert.equal(session.distribution, 'bundled');
  assert.equal(session.release.schemaVersion, 2);
  assert.equal(session.files.length, session.release.fileCount);
  assert.ok(session.files.some((file) => file.path === 'uv.lock'));
  assert.equal(session.files.some((file) => file.path.startsWith('dist/')), false);
  assert.equal(
    session.files.some((file) => file.path.split('/').some((part) => part.startsWith('.'))),
    false,
  );
  assert.equal(
    session.files.find((file) => file.path === 'requirements.txt').editable,
    true,
  );
  assert.equal(
    session.files.find((file) => file.path === 'pyproject.toml').editable,
    false,
  );
  assert.ok(session.files.some((file) => file.path === 'federated_task/task_readiness/check.py'));
  assert.ok(session.files.some((file) => file.path === 'federated_task/federated_learning/server_main.py'));
  assert.ok(session.files.some((file) => file.path === 'federated_task/federated_learning/client_main.py'));
  assert.equal(
    session.files.find((file) => file.path === 'federated_task/local_training/model.py').editable,
    true,
  );
  assert.equal(
    session.files.find((file) => file.path === 'federated_task/runtime/model_release.py').editable,
    false,
  );
  assert.equal(
    session.files.find((file) => file.path === 'federated_task/runtime/progress.py').editable,
    false,
  );
  assert.ok(session.files.some((file) => file.path === 'federated_task/tool_ai/manifest.json'));
  const tool = getBundledBaselineArtifact(
    session.files.find((file) => file.path === 'federated_task/tool_ai/tool.py').artifactId,
  );
  const toolManifest = getBundledBaselineArtifact(
    session.files.find((file) => file.path === 'federated_task/tool_ai/manifest.json').artifactId,
  );
  assert.match(fs.readFileSync(tool.absolutePath, 'utf8'), /def build_tool_data_sample\(data_root: str \| Path, index: int = 0\)/);
  assert.match(fs.readFileSync(tool.absolutePath, 'utf8'), /return load_inference_sample\(data_root, index\)/);
  const dataPreparation = getBundledBaselineArtifact(
    session.files.find((file) => file.path === 'federated_task/local_training/data_preparation.py').artifactId,
  );
  assert.match(fs.readFileSync(dataPreparation.absolutePath, 'utf8'), /def load_inference_sample\(data_root: str \| Path, index: int = 0\)/);
  const toolContract = JSON.parse(fs.readFileSync(toolManifest.absolutePath, 'utf8'));
  assert.ok(toolContract.input.sources.includes('task-data'));
  assert.equal(toolContract.input.jsonSchema.type, 'object');
  assert.equal(toolContract.output.jsonSchema.type, 'object');
  const readme = getBundledBaselineArtifact(
    session.files.find((file) => file.path === 'README.md').artifactId,
  );
  assert.match(fs.readFileSync(readme.absolutePath, 'utf8'), /Open Data Folder/);
  assert.ok(!session.files.some((file) => file.path.endsWith('/parameters.py')));
  const pyproject = getBundledBaselineArtifact(
    session.files.find((file) => file.path === 'pyproject.toml').artifactId,
  );
  const lockfile = getBundledBaselineArtifact(
    session.files.find((file) => file.path === 'uv.lock').artifactId,
  );
  assert.match(fs.readFileSync(pyproject.absolutePath, 'utf8'), /pytorch-cpu/);
  assert.match(fs.readFileSync(lockfile.absolutePath, 'utf8'), /2\.8\.0\+cpu/);
  assert.match(fs.readFileSync(lockfile.absolutePath, 'utf8'), /0\.23\.0\+cpu/);
  assert.doesNotMatch(fs.readFileSync(lockfile.absolutePath, 'utf8'), /name = "nvidia-/);
  const serverMain = getBundledBaselineArtifact(
    session.files.find((file) => file.path === 'federated_task/federated_learning/server_main.py').artifactId,
  );
  const managerMain = getBundledBaselineArtifact(
    session.files.find((file) => file.path === 'federated_task/federated_learning/client_manager_main.py').artifactId,
  );
  assert.match(fs.readFileSync(serverMain.absolutePath, 'utf8'), /server_evaluation\.max_batches/);
  assert.match(fs.readFileSync(serverMain.absolutePath, 'utf8'), /prepare_validation_loader/);
  assert.match(fs.readFileSync(pyproject.absolutePath, 'utf8'), /733f1696edc234073f0c1cd1a96e6580bfbcffeb/);
  assert.match(fs.readFileSync(lockfile.absolutePath, 'utf8'), /version = "1.1.30.18"/);
  assert.match(fs.readFileSync(managerMain.absolutePath, 'utf8'), /GL_Model_V/);
  const taskMain = getBundledBaselineArtifact(
    session.files.find((file) => file.path === 'federated_task/main.py').artifactId,
  );
  assert.doesNotMatch(fs.readFileSync(taskMain.absolutePath, 'utf8'), /FEDOPS_AGGREGATION_SERVER/);
  for (const descriptor of [session.manifest, ...session.files]) {
    const artifact = getBundledBaselineArtifact(descriptor.artifactId);
    assert.ok(artifact);
    assert.equal(fs.statSync(artifact.absolutePath).size, descriptor.size);
    assert.equal(artifact.sha256, descriptor.sha256);
  }
});

test('bundled Baseline 0.18.0 remains unchanged for existing Tasks', () => {
  const session = getBundledBaselineSession('0.18.0');
  assert.equal(session.release.version, '0.18.0');
  const file = session.files.find((entry) => entry.path === 'pyproject.toml');
  assert.match(fs.readFileSync(getBundledBaselineArtifact(file.artifactId, '0.18.0').absolutePath, 'utf8'), /fde3137f6e94bc4558352b109a8c87186d20208c/);
});

test('bundled Baseline 0.17.0 remains downloadable for existing Tasks', () => {
  const session = getBundledBaselineSession('0.17.0');
  assert.equal(session.release.version, '0.17.0');
});

test('bundled Baseline 0.16.0 remains downloadable for existing Tasks', () => {
  const session = getBundledBaselineSession('0.16.0');
  assert.equal(session.release.version, '0.16.0');
});

test('bundled Baseline 0.15.0 remains downloadable for existing Tasks', () => {
  const session = getBundledBaselineSession('0.15.0');
  assert.equal(session.release.version, '0.15.0');
});

test('bundled Baseline 0.14.0 remains downloadable for existing Tasks', () => {
  const session = getBundledBaselineSession('0.14.0');
  assert.equal(session.release.version, '0.14.0');
});

test('bundled Baseline 0.13.0 remains downloadable for existing Tasks', () => {
  const session = getBundledBaselineSession('0.13.0');
  assert.equal(session.release.version, '0.13.0');
});

test('bundled Baseline 0.12.0 remains downloadable for existing Tasks', () => {
  const session = getBundledBaselineSession('0.12.0');
  assert.equal(session.release.version, '0.12.0');
});

test('bundled Baseline 0.11.0 remains downloadable for existing Tasks', () => {
  const session = getBundledBaselineSession('0.11.0');
  assert.equal(session.release.version, '0.11.0');
  assert.ok(session.files.some((file) => file.path === 'federated_task/runtime/model_release.py'));
});

test('bundled Baseline 0.8.0 remains downloadable for existing Tasks', () => {
  const session = getBundledBaselineSession('0.8.0');
  assert.equal(session.release.version, '0.8.0');
  assert.ok(session.files.some((file) => file.path === 'federated_task/task_check.py'));
});

test('bundled Baseline 0.9.0 remains downloadable for existing Tasks', () => {
  const session = getBundledBaselineSession('0.9.0');
  assert.equal(session.release.version, '0.9.0');
  assert.ok(session.files.some((file) => file.path === 'federated_task/tool_ai/manifest.json'));
});

test('bundled Baseline 0.7.0 remains downloadable for existing Tasks', () => {
  const session = getBundledBaselineSession('0.7.0');
  assert.equal(session.release.version, '0.7.0');
  assert.ok(session.files.length > 0);
});

test('bundled Baseline 0.6.0 remains downloadable for existing Tasks', () => {
  const session = getBundledBaselineSession('0.6.0');
  assert.equal(session.release.version, '0.6.0');
  assert.ok(session.files.length > 0);
});

test('bundled Baseline 0.5.0 remains downloadable for existing Tasks', () => {
  const session = getBundledBaselineSession('0.5.0');
  assert.equal(session.release.version, '0.5.0');
  assert.equal(session.release.revision, 2);
  const artifact = getBundledBaselineArtifact(session.manifest.artifactId);
  assert.equal(artifact.sha256, session.manifest.sha256);
});

test('bundled Baseline 0.4.0 remains downloadable for existing Tasks', () => {
  const session = getBundledBaselineSession('0.4.0');
  assert.equal(session.release.version, '0.4.0');
  assert.equal(session.release.revision, 1);
  const artifact = getBundledBaselineArtifact(session.manifest.artifactId);
  assert.equal(artifact.sha256, session.manifest.sha256);
});

test('bundled Baseline 0.3.0 remains downloadable for existing Tasks', () => {
  const session = getBundledBaselineSession('0.3.0');
  assert.equal(session.release.version, '0.3.0');
  const artifact = getBundledBaselineArtifact(session.manifest.artifactId);
  assert.equal(artifact.sha256, session.manifest.sha256);
});

test('unknown bundled Baseline artifact IDs cannot resolve a filesystem path', () => {
  getBundledBaselineSession();
  assert.equal(getBundledBaselineArtifact('../../etc/passwd'), null);
});
