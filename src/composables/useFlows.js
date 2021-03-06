import { readonly, reactive, ref, computed } from "vue";

import { date } from "quasar";

import { Platform } from "quasar";

import electronLocal from "./flowDrivers/useElectronLocal";

// GLOBAL
// A map of Flows w/ ID as index.
const flowMap = reactive(new Map());

// A map of Nugget w/ ID as index.
const nuggetMap = reactive(new Map());

// An map of nuggetSeq by flowId
const nuggetSeqMap = reactive(new Map());

// An array of sequenced Nugget Id's for a given flow.
const nuggetSeq = ref([]);

// The Flow currently being viewed.
// This can be used by the parent and siblings of the Page to display page data.
const pageFlowId = ref(null);

// The `type` of connection.
// lcs|electron|amplifyApi
const flowConnector = ref(null);

// The level above Flows.
// In Electron it is the selected root dir.
// In the single-tenant app it has no meaning.
// In the SaaS app it is an Organization
const flowSource = ref(null);

// Set true to signal we finished loading the Flows and it is safe to display them.
const flowsLoaded = ref(false);

// Is the current flow loaded?
const flowLoaded = ref(false);

// MAIN EXPORT FUNCTION
export default function useFlows() {
  // Useful for list item label or button text
  // Displays truncated selection or propmt to select.
  const flowSourceMsg = computed(() => {
    return flowSource.value ? dirLabel(flowSource.value) : "Select a directory";
  });

  // Truncate a directory label.
  const dirLabel = (dir) => {
    // If less than 25 char use the whole dir
    if (dir.length < 25) {
      return dir;
    }

    return "..." + dir.substr(-22, 22);
  };

  // Connectors object, this does not need to be reactive
  const flowConnectors = {};

  // Load composable functions as connectors.
  // The key can be used as the _readModule and/or _writeModule
  if (Platform.is.electron) {
    flowConnectors.electron = electronLocal();
  }

  // Derive list of connector options from those loaded above
  const flowConnectorList = computed(() => {
    const connectors = [];

    for (const [key, value] of Object.entries(flowConnectors)) {
      connectors.push(key);
    }
    return connectors;
  });

  // Set the flowConnector
  const setFlowConnector = (newConnector) => {
    flowConnector.value = newConnector;
  };

  // Set the flowConnector
  const setFlowSource = (newSource) => {
    flowSource.value = newSource;
  };

  // Get all flows, @todo add pagination
  const loadFlows = async () => {
    console.info("loading flows");
    console.info(
      "Connector: " + flowConnector.value + " Source: " + flowSource.value
    );
    try {
      if (flowConnector.value && flowSource.value) {
        // Use the defined connector
        flowConnectors[flowConnector.value]
          .setRootDir(flowSource.value)
          .then(() => {
            flowConnectors[flowConnector.value].loadFlows().then((flows) => {
              console.debug(flows);
              if (flows) {
                flows.flows.map((key) => {
                  flowMap.set(key.id, key);
                });
              }
              flowsLoaded.value = true;
            });
          });
      }
    } catch (e) {
      console.log("Error Loading Flows");
      console.log(e);
    }
  };

  // Get a single Flow for display in the App page
  const loadFlow = async (
    flowId,
    withNuggets = false,
    withNuggetSeq = false
  ) => {
    try {
      if (flowConnector.value && flowSource.value) {
        await flowConnectors[flowConnector.value].setRootDir(flowSource.value);

        // Use the defined connector
        return flowConnectors[flowConnector.value]
          .getFlowById(flowId, withNuggets, withNuggetSeq)
          .then((flows) => {
            const flow = flows.flows[0];

            // Is a sequence defined? If not we'll use nuggets in the order they appear.
            if (flow.nuggetSeq) {
              nuggetSeqMap.set(flowId, flow.nuggetSeq);
            }

            if (flow.nuggets) {
              // Copy, then delete Nuggets from response
              const nuggets = flow.nuggets;
              // Add each nugget to the nuggetMap
              nuggets.map((key) => {
                nuggetMap.set(key.id, key);
              });
              // Remove the nuggets array from flow
              delete flow.nuggets;
            }

            // Add the flow, minus nuggets, to the same flowMap we use to list Flows.
            flowMap.set(flow.id, flow);

            // Signal the code Flows are loaded and it is safe to display them.
            flowLoaded.value = true;

            return flow;
          });
      }
    } catch (e) {
      console.log("Error Loading Flow: " + flowId);
      console.log(e);
    }
  };

  // Create a new Flow and persist it
  const createFlow = async (flowData) => {
    try {
      // Use the defined connector
      await flowConnectors[flowConnector.value].setRootDir(flowSource.value);

      return flowConnectors[flowConnector.value]
        .createFlow(flowData)
        .then((flowResult) => {
          console.log(flowResult);
          flowMap.set(flowResult.id, flowResult);

          return flowResult;
        });
    } catch (e) {
      console.log("Error Creating Flow");
      console.log(e);
    }
  };

  // Create a new Flow and persist it
  const createNugget = async (flowId, nuggetData, prevNugId = null) => {
    try {
      // Use the defined connector
      await flowConnectors[flowConnector.value].setRootDir(flowSource.value);

      flowConnectors[flowConnector.value]
        .createNugget(flowId, nuggetData)
        .then((nuggetResult) => {
          console.log(nuggetResult);
          nuggetMap.set(nuggetResult.id, nuggetResult);
          // Add the nugget to the Flow.nuggetSeq
          addToNuggetSeq(flowId, nuggetResult.id, prevNugId);
          return nuggetResult;
        });
    } catch (e) {
      console.log("Error Creating Nugget");
      console.log(e);
    }
  };

  // Delete a flow
  const deleteFlow = async (flowId) => {
    try {
      // Use the defined connector
      flowConnectors[flowConnector.value]
        .deleteFlow(flowId)
        .then((flowResult) => {
          flowMap.delete(flowId);
        });
    } catch (e) {
      console.log("Error Deleting Flow");
      console.log(e);
    }
  };

  // Update a single property of a flow.
  // This is the predominate update mechanism when using inline editing.
  const updateFlowProp = async (flowId, propName, propValue) => {
    try {
      // Use the defined connector
      flowConnectors[flowConnector.value]
        .updateFlowProp(flowId, propName, propValue)
        .then((flowResult) => {
          flowMap.set(flowId, flowResult);
        });
    } catch (e) {
      console.log("Error Updating Flow");
      console.log(e);
    }
  };

  const addToNuggetSeq = async (flowId, nuggetId, prevNugId = null) => {
    try {
      await flowConnectors[flowConnector.value].setRootDir(flowSource.value);
      console.log(flowId + " " + nuggetId + " " + prevNugId);
      //Get the existing Flow
      flowConnectors[flowConnector.value]
        .getFlowNuggetSeqById(flowId)
        .then((seqResult) => {
          console.log(seqResult);
          let newSeq = [nuggetId];
          if (seqResult) {
            if (prevNugId === null || prevNugId.length < 1) {
              newSeq = [...newSeq, ...seqResult.nuggetSeq];
            } else {
              const insertIx = seqResult.nuggetSeq.indexOf(prevNugId) + 1;
              newSeq = [
                ...seqResult.nuggetSeq.slice(0, insertIx),
                ...newSeq,
                ...seqResult.nuggetSeq.slice(insertIx),
              ];
              //seqResult.nuggetSeq.splice(insertIx, 0, nuggetId);
            }
          }
          flowConnectors[flowConnector.value].updateFlowData(
            flowId,
            { nuggetSeq: newSeq },
            "nuggetSeq"
          );
          nuggetSeqMap.set(flowId, newSeq);
        });
    } catch (e) {
      console.log("Error updating Nugget sequence");
      console.log(e);
    }
  };

  // Update a single property of a nugget.
  // This is the predominate update mechanism when using inline editing.
  const updateNuggetProp = async (nuggetId, propName, propValue) => {
    try {
      // Use the defined connector
      flowConnectors[flowConnector.value]
        .updateNuggetProp(nuggetId, propName, propValue)
        .then((nuggetResult) => {
          console.log(nuggetResult);
          nuggetMap.set(nuggetId, nuggetResult);
        });
    } catch (e) {
      console.log("Error Updating Flow");
      console.log(e);
    }
  };

  // Delete a Nugget
  const deleteNugget = async (flowId, nuggetId) => {
    try {
      console.log("deleteNugget:useFlows " + flowId + " " + nuggetId);
      // Use the defined connector
      flowConnectors[flowConnector.value]
        .deleteNugget(flowId, nuggetId)
        .then((flowResult) => {
          nuggetMap.delete(nuggetId);
        });
    } catch (e) {
      console.log("Error Deleting Flow");
      console.log(e);
    }
  };

  // Takes any object and uses pubAt and unPubAt props to determine if it is currently published.
  const isPublished = (object) => {
    let published = false;
    console.log(object);
    try {
      // If pubAt isn't set there is no way it is published
      if (object.pubAt) {
        // Now date object for comparing publication dates
        const nowDate = new Date();
        const nowDateId = nowDate.getTime(); // easy to compare represenation of a date

        // The publication start date
        const startDate = new Date(object.pubAt);
        const startDateId = startDate.getTime();

        // If the start date is in the future it is not published, no further processing is needed.
        if (startDateId < nowDateId) {
          // If no unPubAt is set it is published indefinitely
          if (!object.unPubAt) {
            published = true;
          } else {
            // The publication end date
            const endDate = new Date(object.unPubAt);
            const endDateId = endDate.getTime();
            // If the end date is in the future it is published still
            if (endDateId > nowDateId) {
              published = true;
            }
          }
        }
      }
    } catch (e) {
      console.log(e);
    }

    return published;
  };

  const publishedNuggets = (flowId) => {
    const published = reactive(new Map());

    try {
      // Get the defined Nugget Sequence, which includes published and unpublished nuggets.
      const nuggetSeq = flowMap.get(flowId).nuggetSeq;

      // Loop through nuggetSeq and check each nugget to see if it is "inPublication".
      // If it is "inPublication", add iit to the published map.
      nuggetSeq.forEach((nuggetId) => {
        try {
          const nug = nuggetMap.get(nuggetId);
          if (isPublished(nug)) {
            published.set(nuggetId, nug);
          }
        } catch (e) {
          console.log(e);
        }
      });
    } catch (e) {
      console.log(e);
    }

    return published;
  };

  // Use publish dates to determine if currently published.
  const isInPublication = (pubAt, unPubAt = null) => {
    let inPublication = ref(false);

    const nowDate = new Date();
    const nDate = date.getDayIdentifier(nowDate);

    // To be published the following must be true:
    // pubAt must be defined
    if (pubAt) {
      // pubAt must resolve to a valid time
      try {
        // Use the pubAt date as the start date
        const fromDate = new Date(block.pubAt);
        const fDate = date.getDayIdentifier(fromDate);

        // If the fromDate is less than (before) nowDate it may be published.
        if (fDate < nDate) {
          // If there is no unPubDate it is published indefinitely
          if (!unPubAt) {
            inPublication.value = true;
          } else {
            const toDate = new Date(block.unPubAt);
            const tDate = date.getDayIdentifier(toDate);
            // If the toDate is greater than nowDate it is still in publication
            if (tDate > nDate) {
              inPublication.value = true;
            }
          }
        }
      } catch (e) {
        console.log(e);
        // default inPublication set above will be returned
      }
    }
    // If the unPubAt is not provided we assume it is in the future
    // If the unPubDate is in the past it is not in publication

    return inPublication;
  };

  // Get rid of all data from previous flowSource
  const flushAll = async () => {
    flowMap.clear();
    nuggetMap.clear();
    flowsLoaded.value = false;
    flowLoaded.value = false;
    pageFlowId.value = null;
    nuggetSeq.value = [];
  };

  const freshenData = async () => {
    await flushAll();
    setFlowConnector("electron");
    loadFlows();
  };

  return {
    loadFlows,
    flowsLoaded: readonly(flowsLoaded),
    flowLoaded: readonly(flowLoaded),
    flowMap,
    createFlow,
    deleteFlow,
    updateFlowProp,
    loadFlow,
    pageFlowId,
    createNugget,
    nuggetMap,
    updateNuggetProp,
    deleteNugget,
    nuggetSeq,
    isPublished,
    publishedNuggets,
    flowConnector: computed(() => flowConnector.value),
    flowConnectorList,
    setFlowConnector,
    setFlowSource,
    flowSource,
    flowSourceMsg,
    flushAll,
    freshenData,
    nuggetSeqMap,
  };
}
