/**
 * Animation registry.
 *
 * The order here is the order in the sidebar and the order J/K cycles through,
 * so it is also the running order when presenting (docs/presenting.md).
 *
 * Ansible basics build the engine from the bottom up: the agentless SSH round
 * trip, the inventory that says which hosts, the playbook that says what and
 * in which order, idempotency as the property that makes reruns safe, facts
 * and conditionals for mixed estates, handlers for side effects, and roles
 * and collections for reuse - ending on the FQCN shape every later module
 * name follows.
 *
 * AAP 2.7 architecture then wraps that engine: the platform at a glance with
 * the gateway as the single front door, execution environments as the
 * packaged engine, the path of one job launch through every component, the
 * mesh that carries it to remote sites, Event-Driven Ansible as a second way
 * to start a job, and the supported ways to deploy all of it.
 */
import howAnsibleWorks from './animations/how-ansible-works.js';
import inventory from './animations/inventory.js';
import playbookRun from './animations/playbook-run.js';
import idempotency from './animations/idempotency.js';
import factsConditionals from './animations/facts-conditionals.js';
import handlers from './animations/handlers.js';
import rolesCollections from './animations/roles-collections.js';
import aapOverview from './animations/aap-overview.js';
import executionEnvironments from './animations/execution-environments.js';
import jobLaunchFlow from './animations/job-launch-flow.js';
import automationMesh from './animations/automation-mesh.js';
import edaFlow from './animations/eda-flow.js';
import deploymentTopologies from './animations/deployment-topologies.js';

export const animations = [
  // Ansible basics - the beginner path, in order.
  howAnsibleWorks,
  inventory,
  playbookRun,
  idempotency,
  factsConditionals,
  handlers,
  rolesCollections,
  // AAP 2.7 architecture - marked advanced, grouped separately in the sidebar.
  aapOverview,
  executionEnvironments,
  jobLaunchFlow,
  automationMesh,
  edaFlow,
  deploymentTopologies,
];
