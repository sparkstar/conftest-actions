import * as core from '@actions/core';
import * as io from '@actions/io';
import * as tc from '@actions/tool-cache';
import { exec } from '@actions/exec';
import * as path from 'path';
import * as os from 'os';

export class Installer {
  private version: string;
  private installDir: string;

  constructor(version: string) {
    this.version = version;
    this.installDir = path.join(os.tmpdir(), `conftest-${version}`);
  }

  public async install(): Promise<string> {
    await io.mkdirP(this.installDir);

    const url = this.getDownloadUrl();
    const tarballPath = await tc.downloadTool(url);
    await tc.extractTar(tarballPath, this.installDir);

    const conftestPath = path.join(this.installDir, 'conftest');
    await io.mv(path.join(this.installDir, 'conftest'), conftestPath);

    return conftestPath;
  }

  private getDownloadUrl(): string {
    const platform = os.platform();
    const arch = os.arch();
    let platformName: string;
    let archName: string;

    switch (platform) {
      case 'linux':
        platformName = 'Linux';
        break;
      case 'darwin':
        platformName = 'Darwin';
        break;
      case 'win32':
        platformName = 'Windows';
        break;
      default:
        throw new Error(`Unsupported platform: ${platform}`);
    }

    switch (arch) {
      case 'x64':
        archName = 'x86_64';
        break;
      case 'arm64':
        archName = 'arm64';
        break;
      default:
        throw new Error(`Unsupported architecture: ${arch}`);
    }

    return `https://github.com/open-policy-agent/conftest/releases/download/v${this.version}/conftest_${this.version}_${platformName}_${archName}.tar.gz`;
  }
}

// Usage example
(async () => {
  try {
    const installer = new Installer('0.33.0');
    const conftestPath = await installer.install();
    console.log(`Conftest installed at: ${conftestPath}`);
    
    // Execute conftest to validate it's installed correctly
    await exec(conftestPath, ['--version']);
  } catch (error) {
    core.setFailed(`Installation failed: ${error}`);
  }
})();

