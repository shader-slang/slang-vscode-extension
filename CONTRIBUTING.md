# Contributing

This project welcomes contributions and suggestions. Contributions require you to agree to a Contributor License Agreement (CLA) declaring that you have the right to, and actually do, grant the rights to use your contribution.

When you submit a pull request, a CLA bot will determine whether you need to sign a CLA. Simply follow the instructions provided.

## Getting dependencies

First you need to get certain prerequisite files to run the project.

* Fork this repository
* Manually run the `Build Dependencies` workflow from the Actions tab of your fork
* Download the artifacts from the workflow run

This should produce the following files:

* `slang-wasm.js`
* `slang-wasm.d.ts`

Move them into the `media` directory.

## Structure

```plaintext
.
├── client // Language Client
│   └── src
│       └── browserClientMain.ts // Language Client entry point
├── package.json // The extension manifest.
├── server // Language Server
|   └── src
|       └── browserServerMain.ts // Language Server entry point
└── webview // Webview for playground runs. Runs WebGPU
    └── src
        └── app.ts // Vue entry point
```

## Running the Sample

- Run `npm install` in this folder. This installs all necessary npm modules in both the client and server folder
- Open VS Code on this folder.
- Press Ctrl+Shift+B to compile the client and server.
- Switch to the Debug viewlet.
- Select `Run Web Extension` from the drop down.
- Run the launch config.

You can also run and debug the extension in a browser

- `npm run chrome`
- use browser dev tools to set breakpoints
