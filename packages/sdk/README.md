# Zonké TypeScript SDK

Deploy and manage Next.js, React, and Remix preview environments to your AWS account(s). Build your code locally and share with your team. Preview sites are deployed on serverless infrastructure, so environments are free to low-cost.

**NOTE**: Refer to the [CLI package](https://github.com/zonke-inc/sdk-ts/tree/main/packages/cli#readme) for a consumer of the SDK.

## Features
- Build locally and deploy to your AWS account in minutes.
- Monitor and manage deployment infrastructure in dashboard.
- Delete preview environments when not in use.

## Getting Started
1. Create an account on [Zonké](https://zonke.dev/)
2. Link your AWS on the dashboard: https://zonke.dev/dashboard. Learn how to [create and link an IAM role](https://docs.zonke.dev/guides/aws/create-iam-access-role) in the docs.
3. Install the [GitHub App](https://github.com/apps/zonke-connector) to your target repositories.
4. Create and deploy your preview environment from the dashboard.
5. Get your API keys from your account settings page.

### Pre-requisites
- API key and token from account settings dashboard.
- AWS hosted zone in the linked AWS account.
- If deploying a Next.js app, set the output type in your config before building:
```
# export - Static output deployed to CDN
# standalone - Static output + SSR lambda
const nextConfig = {
  output: 'standalone' | 'export',
};
```

#### Build Folder by Framework
Each environment specifies a dedicated build output folder that the SDK zips and deploys. These are the expected folders for each framework:

- Next.js:
  - `export` - `out` or `dist`, depending on build tool.
  - `standalone` - `.next`. Make sure the `.next/standalone` folder exists.
- React - `out` or `dist`, depending on build tool.
- Remix - `build` with `build/client` for static assets and `build/server` for SSR lambda.


## Methods

### `async createPreviewEnvironment(payload: CreatePreviewEnvironmentPayload): Promise<PreviewEnvironment>`

Calls the Zonké API to create a preview environment. Note that this only defines the preview environment, it does not deploy any code to it. To deploy code to the preview environment, use `deployToPreviewEnvironment`.

#### Parameters
- `payload` (CreatePreviewEnvironmentPayload): The payload required to create a preview environment.
  - `userId` (string): The ID of the user creating the preview environment.
  - `framework` (string): The framework to be used for the preview environment.
- `awsHostedZone` (string): The AWS hosted zone for the preview environment.

#### Returns
- `Promise<PreviewEnvironment>`: A promise that resolves to the created preview environment. The versions array will always be empty.

#### Example
```typescript
const client = new PreviewEnvironmentClient({
  apiKey: 'your-api-key',
  apiToken: 'your-api-token',
  apiEndpoint: 'https://zonke.dev/api/rest',
});

const previewEnvironment = await client.createPreviewEnvironment({
  userId: 'user-123',
  framework: 'react',
  awsHostedZone: 'example.com',
});

console.log(previewEnvironment);
```

#### `async deployToPreviewEnvironment(payload: DeployToPreviewEnvironmentPayload): Promise<DeploymentResult>`

Deploys code to an existing preview environment.

#### Parameters
- `payload` (DeployToPreviewEnvironmentPayload): The payload required to deploy code to the preview environment.
  - `environmentId` (string): The ID of the preview environment to deploy to.
  - `buildOutputDirectory` (string): The build directory that will be deployed to the preview environment.
  - [Optional] `publicDirectory` (string): Path to the public (static files) directory of the project. This is only required for Next.js projects.
  - [Optional] `uploadLinkExpirationOverride` (string) - The number of seconds the deployment endpoint will be active for. Increase this value if zipping your build output takes longer than 60 seconds.
  - [Optional] `message` - Short message that describes the change in the version. Think of this as a GIT commit message.

#### Returns
- `Promise<DeploymentResult>`: A promise that resolves to the result of the deployment.

#### Example
```typescript
const client = new PreviewEnvironmentClient({
  apiKey: 'your-api-key',
  apiToken: 'your-api-token',
  apiEndpoint: 'https://zonke.dev/api/rest',
});

const deploymentResult = await client.deployToPreviewEnvironment({
  environmentId: 'env-123',
  buildOutputDirectory: 'path/to/build',
  publicDirectory: 'path/to/public/folder',
  message: 'Take a look at this cool feature. LFG!!!',
});

console.log(deploymentResult);
```

#### `async getPreviewEnvironment(environmentId: string): Promise<PreviewEnvironment>`

Retrieves details of an existing preview environment.

#### Parameters
- `environmentId` (string): The ID of the preview environment to retrieve.

#### Returns
- `Promise<PreviewEnvironment>`: A promise that resolves to the details of the preview environment.

#### Example
```typescript
const client = new PreviewEnvironmentClient({
  apiKey: 'your-api-key',
  apiToken: 'your-api-token',
  apiEndpoint: 'https://zonke.dev/api/rest',
});

const previewEnvironment = await client.getPreviewEnvironment('env-123');

console.log(previewEnvironment);
```

#### `async getDeploymentStatus(payload: PreviewEnvironmentDeploymentStatusPayload): Promise<DeploymentStatus>`

Retrieves the status of a specific deployment.

#### Parameters
- `payload` (PreviewEnvironmentDeploymentStatusPayload) - The payload required to check the build status.
  - `deploymentId` (string): The ID of the deployment to retrieve the status for.
  - `sourceVersion` (string): The version to check the deployment status of.

#### Returns
- `Promise<DeploymentStatus>`: A promise that resolves to the status of the deployment.

#### Example
```typescript
const client = new PreviewEnvironmentClient({
  apiKey: 'your-api-key',
  apiToken: 'your-api-token',
  apiEndpoint: 'https://zonke.dev/api/rest',
});

const deploymentStatus = await client.getDeploymentStatus({
  environmentId: 'deploy-123',
  sourceVersion: 'source-version-id',
});

console.log(deploymentStatus);
```

#### `async revertPreviewEnvironmentToVersion(payload: RevertPreviewEnvironmentToVersionPayload): Promise<RevertResult>`

Reverts a preview environment to a specified version.

#### Parameters
- `payload` (RevertPreviewEnvironmentToVersionPayload): The payload required to revert the preview environment.
  - `environmentId` (string): The ID of the preview environment to revert.
  - `sourceVersion` (string): The version to revert to.

#### Returns
- `Promise<RevertResult>`: A promise that resolves to the result of the revert operation.

#### Example
```typescript
const client = new PreviewEnvironmentClient({
  apiKey: 'your-api-key',
  apiToken: 'your-api-token',
  apiEndpoint: 'https://zonke.dev/api/rest',
});

const revertResult = await client.revertPreviewEnvironmentToVersion({
  environmentId: 'env-123',
  version: 'version-string',
});

console.log(revertResult);
```

### `async deletePreviewEnvironment(environmentId: string): Promise<DeleteResult>`

Deletes an existing preview environment.

#### Parameters
- `environmentId` (string): The ID of the preview environment to delete.

#### Returns
- `Promise<DeleteResult>`: A promise that resolves to the result of the delete operation.

#### Example:
```typescript
const client = new PreviewEnvironmentClient({
  apiKey: 'your-api-key',
  apiToken: 'your-api-token',
  apiEndpoint: 'https://zonke.dev/api/rest',
});

const deleteResult = await client.deletePreviewEnvironment('env-123');

console.log(deleteResult);
```
