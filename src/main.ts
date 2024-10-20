import * as fs from 'fs'

import * as core from '@actions/core'
import * as exec from '@actions/exec'
import * as github from '@actions/github'

import { Installer } from './install'
import { YamlLineFinder } from './yamlparser'

function mapLevelToConclusion(
  level: 'warnings' | 'failures'
):
  | 'action_required'
  | 'cancelled'
  | 'failure'
  | 'neutral'
  | 'success'
  | 'skipped'
  | 'stale'
  | 'timed_out' {
  switch (level) {
    case 'warnings':
      return 'neutral'
    case 'failures':
      return 'failure'
    default:
      return 'neutral'
  }
}

export async function run(): Promise<void> {
  const dirs = core.getInput('dirs')
  const version = core.getInput('version')
  const policyPath = core.getInput('policy')

  const installer = new Installer(version)
  const conftestPath = await installer.install()

  const args = ['test', '--policy', policyPath, '--output', 'json', dirs]
  let outputData = ''

  try {
    await exec.exec(conftestPath, args, {
      listeners: {
        stdout: (data: Buffer) => {
          outputData += data.toString()
        }
      }
    })
  } catch (error) {
    core.error(`Conftest validation failed: ${error}`)
  }

  /*
  workflow commands
  https://docs.github.com/en/actions/writing-workflows/choosing-what-your-workflow-does/workflow-commands-for-github-actions

  https://docs.github.com/en/actions/writing-workflows/choosing-what-your-workflow-does/workflow-commands-for-github-actions#grouping-log-lines
  Creates an expandable group in the log.
  > ::group::{title}
  > ::endgroup::

  ```bash
  ::group::Testing 'workflows/initcontainer-without-name.yaml' against 9 policies in namespace 'main'
  ::error file=workflows/initcontainer-without-name.yaml::metadata.labels must contain a "arceye.naverlabs.io/workflow-type" with a non-empty value.
  ::warning file=workflows/initcontainer-without-name.yaml::spec.templates[0].container should specify a 'name'.
  success file=workflows/initcontainer-without-name.yaml 7
  ::endgroup::
  ```
  */

  function getLineNumber(filePath: string, selector: string): number {
    const yamlContent = fs.readFileSync(filePath, 'utf8')
    const finder = new YamlLineFinder(yamlContent)
    return finder.query(selector)
  }

  let validations: string[] = []
  validations.push(`::gruop::Validation results`)
  const results = JSON.parse(outputData)
  for (const result of results) {
    if (result['warnings']) {
      for (const warning of result['warnings']) {
        const level = 'warning'
        const [selector, _] = warning['msg']
          .split(':')
          .map((part: string) => part.trim())
        const lineNumber = getLineNumber(result['filename'], selector)
        const validation = createWorkflowCommand(
          level,
          result['filename'],
          lineNumber,
          warning['msg']
        )
        validations.push(validation)
      }
    }
    if (result['failures']) {
      for (const failure of result['failures']) {
        const level = 'failure'
        const [selector, _] = failure['msg']
          .split(':')
          .map((part: string) => part.trim())
        const lineNumber = getLineNumber(result['filename'], selector)
        const validation = createWorkflowCommand(
          level,
          result['filename'],
          lineNumber,
          failure['msg']
        )
        validations.push(validation)
      }
    }
  }
  validations.push(`::endgroup::`)
}

// how to use?
async function createAnnotation(
  message: string,
  level: 'notice' | 'warning' | 'failure',
  filePath: string,
  conclusion:
    | 'action_required'
    | 'cancelled'
    | 'failure'
    | 'neutral'
    | 'success'
    | 'skipped'
    | 'stale'
    | 'timed_out',
  lineNumber: number
): Promise<void> {
  const { context } = github
  const { pull_request } = context.payload

  if (pull_request) {
    console.log(`${level} - ${filePath}, ${message} - ${lineNumber}`)
    const octokit = github.getOctokit(core.getInput('github_token'))
    const owner = context.repo.owner
    const repo = context.repo.repo

    await octokit.rest.checks.create({
      owner,
      repo,
      name: 'Conftest Validation',
      head_sha: context.sha,
      conclusion,
      output: {
        title: 'Conftest Validation',
        summary: message,
        annotations: [
          {
            path: filePath,
            start_line: lineNumber,
            end_line: lineNumber,
            annotation_level: level,
            message
          }
        ]
      }
    })
  }
}

function createWorkflowCommand(
  level: 'warning' | 'failure',
  filePath: string,
  lineNumber: number,
  message: string
): string {
  if (level === 'failure') {
    return `::error file=${filePath},line=${lineNumber}::${message}`
  }
  // else if (level === 'warning') {
  return `::warning file=${filePath},line=${lineNumber}::${message}`
}
