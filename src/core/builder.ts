import fs from "fs";
import path from "path";
import shell from "shelljs";
import { detectRuntime, RuntimeType } from "./runtimes";
import { getBin, readConfigFile } from "./utils";

const exec = (command: string, options = {}) => shell.exec(command, { async: false, ...options });

// use the concurrently binary provided by this emulator
const concurrentlyBin = getBin("concurrently");

const nodeBuilder = (location: string, buildCommand: string, name: string, colour: string) => {
  const appBuildCommand = [
    "CI=1",
    concurrentlyBin,
    `--names ${name}`,
    `-c '${colour}'`,
    `--kill-others-on-fail`,
    `"npm install && ${buildCommand}"`,
    `--color=always`,
  ].join(" ");
  exec(appBuildCommand, {
    cwd: location,
  });
};

const dotnetBuilder = (location: string, name: string, colour: string) => {
  const appBuildCommand = [
    "CI=1",
    concurrentlyBin,
    `--names ${name}`,
    `-c '${colour}'`,
    `--kill-others-on-fail`,
    `"dotnet build"`,
    `--color=always`,
  ].join(" ");
  exec(appBuildCommand, {
    cwd: location,
  });
};

const builder = ({ config }: { config: Partial<GithubActionSWAConfig> }) => {
  const configFile = readConfigFile();
  if (configFile) {
    let { appLocation, apiLocation, appBuildCommand, apiBuildCommand } = config as GithubActionSWAConfig;
    const runtimeType = detectRuntime(appLocation);

    try {
      switch (runtimeType) {
        case RuntimeType.dotnet:
          {
            // build app
            dotnetBuilder(appLocation as string, "app_build", "bgGreen.bold");

            // NOTE: API is optional. Build it only if it exists
            // This may result in a double-compile of some libraries if they are shared between the
            // Blazor app and the API, but it's an acceptable outcome
            apiLocation = path.resolve(process.cwd(), apiLocation as string);
            if (fs.existsSync(apiLocation) === true && fs.existsSync(path.join(apiLocation, "host.json"))) {
              dotnetBuilder(apiLocation, "api_build", "bgYellow.bold");
            }
          }
          break;

        case RuntimeType.node:
        default:
          {
            // figure out if appLocation exists
            if (fs.existsSync(appLocation as string) === false) {
              appLocation = process.cwd();
            }

            // build app
            nodeBuilder(appLocation as string, appBuildCommand as string, "app_build", "bgGreen.bold");

            // NOTE: API is optional. Build it only if it exists
            apiLocation = path.resolve(process.cwd(), apiLocation as string);
            if (fs.existsSync(apiLocation) === true && fs.existsSync(path.join(apiLocation, "host.json"))) {
              nodeBuilder(apiLocation, apiBuildCommand as string, "api_build", "bgYellow.bold");
            }
          }
          break;
      }
    } catch (stderr) {
      shell.echo(stderr);
    }
  }
};
export default builder;
