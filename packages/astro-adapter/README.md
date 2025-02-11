# Astro Adapter
An Astro adapter to deploy static or SSR sites to AWS using Zonké.


## Installation
### Configuration Options
- `output` - The output type of the Astro project. Options are:
  - `static` - Deploy as a static site.
  - `server` - Deploy as a server-rendered site.
- `target` - The target deployment environment. Options are:
  - `s3` - Deploy to S3 (behind CloudFront) for static site hosting. Corresponds to the `static` output type.
  - `lambda` - Deploy to S3, CloudFront, and Lambda with SSR support. Corresponds to the `server` output type.
  - `EC2` (Coming Soon) - Deploy to S3, CloudFront, and ECS EC2 with SSR support. Corresponds to the `server` output type.
  - `Fargate` (Coming Soon) - Deploy to S3, CloudFront, and ECS Fargate with SSR support. Corresponds to the `server` output type.
- `serverBundleOptions` (optional) - Used to bundle the server code for SSR deployments. Conforms to the [BuildOptions](https://esbuild.github.io/api/#build-options) interface from esbuild. You should only need to specify the `external` option to exclude certain modules from the bundle:

  ```js
  serverBundleOptions: {
      external: ['fsevents', 'sharp', 'lightningcss', 'vite'],
  }
  ```

  **NOTE**: Modules marked as `external` will be installed in the server directory and included in the deployment package.

### Using `astro add`
To install the Astro adapter and update your `astro.config.mjs`, run:

```sh
npx astro add @zonke-cloud/astro-adapter
```

### Manual Installation
Install the Astro adapter:

```sh
npm install @zonke-cloud/astro-adapter
```

Update your `astro.config.mjs` to include the adapter:

```ts
import aws from '@zonke-cloud/astro-adapter';

export default {
  output: 'server', // or 'static'
  adapter: aws({
    target: 'lambda', // or 's3'
		serverBundleOptions: {
      // Example of excluding modules from the server bundle.
			external: ['fsevents', 'sharp', 'lightningcss', 'vite'],
		},
  }),
};
```

**NOTE**: You should not need the adapter for static deployments, but it will work if you include it.

## Acknowledgements
The package is inspired by the [astro-aws](https://github.com/lukeshay/astro-aws) adapter and modified to work with Zonké's deployment infrastructure.

---

Maintained by the [Zonké team](https://zonke.dev) | [Discord](https://discord.gg/CRNPV8BkjC) | [Twitter](https://x.com/ZonkeInc) | [LinkedIn](https://www.linkedin.com/company/zonke-inc)
