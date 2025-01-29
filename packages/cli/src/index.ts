#!/usr/bin/env node

import { input, select, password } from '@inquirer/prompts';
import { Command } from 'commander';
import { oraPromise } from 'ora';

import { SupportedFrameworks } from '@zonke-cloud/sdk';

import {
  createCredentials,
  deleteEnvironment,
  deploy,
  initializeEnvironment,
  status,
} from './commands';
import { Project } from './model';


export function cli() {
  const program = new Command();

  program
    .command('init')
    .description('Initialize Zonké Project')
    .action(async () => {
      const { apiKey, apiToken } = {
        apiKey: await password({ message: 'API key (found in Zonké dashboard): ' }),
        apiToken: await password({ message: 'API token (found in Zonké dashboard): ' }),
      };

      await createCredentials({ apiKey, apiToken });

      const { framework, awsHostedZone, buildOutputDirectory } = {
        framework: await select({
          choices: Object.values(SupportedFrameworks),
          message: 'Project frontend framework: ',
        }),
        awsHostedZone: await input({ message: 'AWS hosted zone name: ' }),
        buildOutputDirectory: await input({ message: 'Build output path: ' }),
      };

      let packageJsonPath: string | undefined = undefined;
      let publicDirectory: string | undefined = undefined;
      const frameworkEnum = framework as SupportedFrameworks;
      if (frameworkEnum === SupportedFrameworks.Remix) {
        packageJsonPath = await input({ message: 'Path to package.json: ' });
      } else if (frameworkEnum === SupportedFrameworks.NextJs) {
        publicDirectory = await input({ message: 'Path to public directory: ' });
      }

      const project: Project = {
        awsHostedZone,
        packageJsonPath,
        publicDirectory,
        buildOutputDirectory,
        framework: frameworkEnum,
      };
      await oraPromise(initializeEnvironment(project), {
        text: 'Initializing environment...',
        failText: 'Environment initialization failed',
        successText: 'Environment initialized',
      });
    });

  program
    .command('deploy')
    .option('-m, --message <message>', 'A message to attach to the deployment')
    .option('-v, --version <version>', 'The version of the project to deploy', 'latest')
    .description('Deploy Zonké Project')
    .action(async ({ message, version }) => {
      await oraPromise(deploy(message, version), {
        text: 'Triggering environment deployment...',
        failText: 'Deployment failed',
        successText: 'Deployment triggered successfully',
      });
    });

  program
    .command('deployment-status')
    .description('Get the status of the latest deployment')
    .action(async () => {
      await status();
    });

  program
    .command('delete-environment')
    .description('Delete the current preview environment and AWS resources.')
    .action(async () => {
      await oraPromise(deleteEnvironment(), {
        text: 'Deleting environment...',
        failText: 'Environment deletion failed',
        successText: 'Environment deleted',
      });
    });

  return program;
}

if (process.env.NODE_ENV !== 'test') {
  cli().parse(process.argv);
}
