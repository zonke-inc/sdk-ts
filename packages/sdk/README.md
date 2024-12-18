# Zonké TypeScript SDK

Deploy and manage Next.js, React, and Remix preview environments to your AWS account(s). Build your code locally and share with your team. Preview sites are deployed on serverless infrastructure, so environments are free to low-cost.

**NOTE**: Refer to the [CLI package](https://github.com/zonke-inc/sdk-ts/tree/main/packages/cli#readme) for a consumer of the SDK.

## Getting Started
1. Create an account on [Zonké](https://zonke.dev/)
2. Link your AWS on the dashboard: https://zonke.dev/dashboard. Learn how to [create and link an IAM role](https://docs.zonke.dev/guides/aws/create-iam-access-role) in the docs.
3. Install the [GitHub App](https://github.com/apps/zonke-connector) to your target repositories.
4. Create and deploy your preview environment from the dashboard.
5. Get your API keys from your account settings page.


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
  - `version` (string): The version of the code to deploy.
- `sourceCode` (string): The source code to deploy.

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
  version: '1.0.0',
  sourceCode: 'console.log("Hello, world!");',
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

#### `async getDeploymentStatus(deploymentId: string): Promise<DeploymentStatus>`

Retrieves the status of a specific deployment.

#### Parameters
- `deploymentId` (string): The ID of the deployment to retrieve the status for.

#### Returns
- `Promise<DeploymentStatus>`: A promise that resolves to the status of the deployment.

#### Example
```typescript
const client = new PreviewEnvironmentClient({
  apiKey: 'your-api-key',
  apiToken: 'your-api-token',
  apiEndpoint: 'https://zonke.dev/api/rest',
});

const deploymentStatus = await client.getDeploymentStatus('deploy-123');

console.log(deploymentStatus);
```

#### `async revertPreviewEnvironmentToVersion(payload: RevertPreviewEnvironmentPayload): Promise<RevertResult>`

Reverts a preview environment to a specified version.

#### Parameters
- `payload` (RevertPreviewEnvironmentPayload): The payload required to revert the preview environment.
  - `environmentId` (string): The ID of the preview environment to revert.
- `version` (string): The version to which the preview environment should be reverted.

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
