# Using TachyonCMS XDesktop client with Storj Network

## Install Storj Uplink CLI

Directions are available here:
https://docs.storj.io/dcs/api-reference/uplink-cli/

## Make sure you are using the correct TachyonCMS branch

We anticipate this being in the core code soon, but for now its is in the `storj-backend` branch.
https://github.com/TachyonCMS/desktop-editor/tree/storj-backend

## Ensure all the required packages are installed

```bash
yarn install
```

## Start the app

```bash
quasar dev
## Select Storj as the Provider within the App

You will be forced to choose a provider. For now your choices are Storj or local files, choose Storj.
```
