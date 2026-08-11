import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const repositoryUrl = "git+https://github.com/Hoeur/chatgate-sdk.git";
const packageDirectories = ["core", "react", "vue", "react-native"];

async function readPackageJson(path) {
  return JSON.parse(await readFile(resolve(path, "package.json"), "utf8"));
}

const rootPackage = await readPackageJson(".");
const releaseTag = process.env.RELEASE_TAG?.trim();
const releaseVersion = releaseTag?.replace(/^v/, "");

if (rootPackage.repository?.url !== repositoryUrl) {
  throw new Error(`Root repository URL must be ${repositoryUrl}`);
}

if (releaseVersion && releaseVersion !== rootPackage.version) {
  throw new Error(
    `Release tag ${releaseTag} does not match workspace version ${rootPackage.version}`,
  );
}

for (const directory of packageDirectories) {
  const packageJson = await readPackageJson(`packages/${directory}`);

  if (packageJson.version !== rootPackage.version) {
    throw new Error(
      `${packageJson.name} is ${packageJson.version}; expected ${rootPackage.version}`,
    );
  }

  if (packageJson.repository?.url !== repositoryUrl) {
    throw new Error(`${packageJson.name} repository URL must be ${repositoryUrl}`);
  }

  if (packageJson.repository?.directory !== `packages/${directory}`) {
    throw new Error(
      `${packageJson.name} repository directory must be packages/${directory}`,
    );
  }

  const expectedWorkspaceVersion = `^${rootPackage.version}`;
  if (
    packageJson.name !== "@chatgate/core" &&
    packageJson.peerDependencies?.["@chatgate/core"] !== expectedWorkspaceVersion
  ) {
    throw new Error(
      `${packageJson.name} must require @chatgate/core ${expectedWorkspaceVersion}`,
    );
  }

  if (rootPackage.dependencies?.[packageJson.name] !== expectedWorkspaceVersion) {
    throw new Error(
      `Workspace dependency ${packageJson.name} must be ${expectedWorkspaceVersion}`,
    );
  }
}

console.log(
  `Release metadata is valid for ChatGate SDK ${rootPackage.version}${
    releaseTag ? ` (${releaseTag})` : ""
  }.`,
);
