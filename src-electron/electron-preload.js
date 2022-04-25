const path = require("path");
const {
  promises,
  constants,
  access,
  exists,
  readFile,
  readdir,
  writeFile,
  mkdir,
  unlink,
  unlinkSync,
  rmSync,
  writeFileSync,
  existsSync,
} = require("fs");

const tachyonFormatVers = "1.0";

// Required
const { contextBridge } = require("electron");
// Used to choose the root directory
import { dialog } from "@electron/remote";

// Use the OS specific path separator to allow use on all OS.
const osSep = path.sep;

// Consistent means to get a current date string
const getNow = () => {
  return new Date().toISOString();
};

/**
 * The functions in the following section are NOT exported in the electronApi.
 * They are used by multiple functions that are exported.
 */

// Open multiple JSON files async and return final result
const getJsonMulti = async (rootDir, type, idArray) => {
  const objects = [];

  await Promise.all(
    idArray.map(async (objectId) => {
      console.log(objectId);
      let readResult = {};
      switch (type) {
        case "nugget":
          readResult = await readJson([rootDir, "nuggets", objectId], "nugget");
          break;
        case "flow":
          readResult = await readJson([rootDir, "flows", objectId], "flow");
          break;
      }
      // Only push successful objects, don't error on failed reads.
      if (readResult.status === "success") {
        objects.push(readResult.data);
      }
    })
  );

  return objects;
};

// We can't use the preferred 'create and handle failure' paradigm because we want to offer the user an option.
const ensureSubDir = async (rootDir, subDir) => {
  const fullPath = rootDir + osSep + subDir;
  try {
    if (existsSync(fullPath)) {
      return { lastLoadedAt: currentTime };
    }

    mkdirSync(fullPath);
  } catch (e) {
    return { error: "failed to create " + fullPath };
  }
};

// Read and Parse a JSON file
const readJson = async (dirs = [], fileName) => {
  return new Promise((resolve, reject) => {
    try {
      const dirPath = dirs.join(osSep);
      const fullPath = dirPath.replace(/\/+$/, "") + osSep + fileName + ".json";
      console.log("filedata for: " + fullPath);

      readFile(fullPath, "utf8", (err, fileData) => {
        if (err) {
          console.log("err - rejecting with failure");
          console.error(err);
          reject({ status: "failure" });
        } else {
          const parsedData = JSON.parse(fileData);
          resolve({ status: "success", data: parsedData });
        }
      });
    } catch (e) {
      console.log(e);
      reject({ status: "failure" });
    }
  });
};

const writeJson = async (dirs = [], fileName, fileData) => {
  try {
    const dirPath = dirs.join(osSep);
    console.log(dirPath);
    mkdirSync(dirPath, { recursive: true });
    const fullPath = dirPath + osSep + fileName + ".json";
    writeFileSync(fullPath, JSON.stringify(fileData, null, 2));

    return { status: "success", data: fileData };
  } catch (e) {
    console.log(e);
    return { status: "failure" };
  }
},

/**
 * The functions ARE EXPORTED in the electronApi.
 * Any code in the app can call `electronApi.:function`.
 * Because they all are exposeInTheMainWorld via the contextBridge
 */
contextBridge.exposeInMainWorld("electronApi", {
  // Triggers an OS local file dialog and returns the selected directory.
  openDirectoryDialog: async (title, folder, filters) => {
    // calling showOpenDialog from Electron API: https://www.electronjs.org/docs/latest/api/dialog/
    const response = await dialog.showOpenDialog({
      title,
      filters,
      properties: ["openDirectory"],
    });
    //console.log("Directory selected: " + response.filePaths);
    return response.filePaths;
  },

  // Create required directories if missing
  initRootDir: async (selectedDir) => {
    ensureSubDir(selectedDir, "flows");
    ensureSubDir(selectedDir, "nuggets");
    writeTachyonJson(selectedDir);
  },

  // Create a file signifying this is a TachyonCMS rootDir
  // This is used a guard when deleting a directory.
  // It will also contain meta and management info down the road.
  writeTachyonJson: async (selectedDir) => {
    // Basic meta data
    const metaData = { createdAt: getNow(), dataFormatVers: tachyonFormatVers };
    writeJson([selectedDir], `tachyon`, metaData)
  },

  // Verify the user has read/write access to the selected directory
  dirAccessible: async (dirSegments) => {
    try {
      const dir = dirSegments.join(osSep);
      return new Promise((resolve, reject) => {
        access(dir, constants.R_OK | constants.W_OK, (error) => {
          resolve(!error);
        });
      });
    } catch (e) {
      console.log("ERROR: " + e);
      return false;
    }
  },

  // Load Flow files from the selected directory
  getElectronFlows: async (rootDir) => {
    const defaultFlows = [];

    try {
      console.log("GET - All Flows from " + rootDir);

      // The parent directory that we expect to find Flows defined in sub-directories.
      const flowsDir = rootDir + osSep + "flows";

      const dirEntries = await promises.readdir(flowsDir, {
        withFileTypes: true,
      });

      const dirs = dirEntries
        .filter((de) => de.isDirectory())
        .map((de) => de.name);

      const fileFlows = await getJsonMulti(rootDir, "flow", dirs);

      const flows = [...defaultFlows, ...fileFlows];

      return flows;
    } catch (e) {
      console.log(e);
      return defaultFlows;
    }
  },

  writeJson: async (dirs = [], fileName, fileData) => {
    try {
      const dirPath = dirs.join(osSep);
      console.log(dirPath);
      mkdirSync(dirPath, { recursive: true });
      const fullPath = dirPath + osSep + fileName + ".json";
      writeFileSync(fullPath, JSON.stringify(fileData, null, 2));

      return { status: "success", data: fileData };
    } catch (e) {
      console.log(e);
      return { status: "failure" };
    }
  },

  getElectronFlowById: async (rootDir, flowId) => {
    try {
      console.log("GET - Flow ID: " + flowId);

      // The parent directory that we expect to find Flows defined in sub-directories.
      const flowDir = rootDir + osSep + "flows" + osSep + flowId + osSep;

      try {
        const flow = readJson([flowDir], "flow");
        return flow;
      } catch (e) {
        console.log(e);
        return null;
      }
    } catch (e) {
      console.log(e);
      return null;
    }
  },

  getElectronNuggetById: async (rootDir, nuggetId) => {
    try {
      console.log("GET - Nugget ID: " + nuggetId);

      // The parent directory that we expect to find Flows defined in sub-directories.
      const nuggetDir = rootDir + osSep + "nuggets" + osSep + nuggetId + osSep;

      try {
        const nugget = readJson([nuggetDir], "nugget");
        return nugget;
      } catch (e) {
        console.log(e);
        return null;
      }
    } catch (e) {
      console.log(e);
      return null;
    }
  },

  getFlowData: async (rootDir, flowId, dataType) => {
    try {
      console.log("GET - FlowData for ID: " + flowId);

      // The parent directory that we expect to find Flows defined in sub-directories.
      const flowDir = rootDir + osSep + "flows" + osSep + flowId;

      const flowDataResult = await readJson([flowDir], dataType);
      if (flowDataResult.status != "success") {
        return null;
      }

      return flowDataResult.data;
    } catch (e) {
      console.log("ERROR CAUGHT");
      console.log(e);
    }
  },

  getJsonMulti: async (rootDir, type, idArray) => {
    const objects = [];

    await Promise.all(
      idArray.map(async (objectId) => {
        console.log(objectId);
        let readResult = {};
        switch (type) {
          case "nugget":
            readResult = await readJson(
              [rootDir, "nuggets", objectId],
              "nugget"
            );
            break;
          case "flow":
            readResult = await readJson([rootDir, "flows", objectId], "flow");
            break;
        }

        if (readResult.status && readResult.status === "success") {
          objects.push(readResult.data);
        }
      })
    );

    console.log("getJsonMulti");
    console.log(objects);

    return objects;
  },

  deleteJson: async (dirs = [], fileName, fileData) => {
    try {
      const dirPath = dirs.join(osSep);
      const fullPath = dirPath + osSep + fileName + ".json";
      unlinkSync(fullPath);

      return { status: "success", deleted: fullPath };
    } catch (e) {
      console.log(e);
      return { status: "failure" };
    }
  },

  deleteDir: async (dirs = []) => {
    try {
      const dirPath = dirs.join(osSep);
      rmSync(dirPath, { recursive: true });
      return { status: "success", deleted: dirPath };
    } catch (e) {
      console.log(e);
      return { status: "failure" };
    }
  },
});
