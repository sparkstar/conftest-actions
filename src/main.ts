import * as core from '@actions/core';
import * as exec from '@actions/exec';
import { Installer } from './install';
import * as fs from 'fs';
import * as path from 'path';

async function run(): Promise<void> {
  try {
    // Get inputs
    const version = core.getInput('version');
    const policyPath = core.getInput('policy');
    const output = core.getInput('output');
    const exitOnError = core.getBooleanInput('exitOnError');

    // Install conftest
    const installer = new Installer(version);
    const conftestPath = await installer.install();

    // Determine policy directory or fallback
    let finalPolicyPath = policyPath;
    if (!fs.existsSync(policyPath)) {
      core.warning(`Policy directory '${policyPath}' not found. Falling back to default policy.`);
      finalPolicyPath = path.join(__dirname, 'default_policy');
    }

    // Run conftest test command
    const args = ['test', '.', '--policy', finalPolicyPath, '--output', output];
    let exitCode = 0;
    try {
      await exec.exec(conftestPath, args);
    } catch (error) {
      core.error(`Conftest validation failed: ${error}`);
      exitCode = 1;
    }

    // Handle exit on error
    if (exitCode !== 0 && !exitOnError) {
      core.setFailed('Conftest validation failed, but exitOnError is set to false. Returning success.');
    } else if (exitCode !== 0) {
      core.setFailed('Conftest validation failed.');
    }
  } catch (error) {
    if (error instanceof Error) {
      core.setFailed(error.message);
    }
  }
}

run();

