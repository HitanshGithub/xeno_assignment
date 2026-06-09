export {
  createCampaign,
  listCampaigns,
  getCampaign,
  updateCampaign,
  deleteCampaign,
  type CampaignInput,
} from './service';
export { launchCampaign, LaunchError, type LaunchResult } from './launch';
export {
  renderTemplate,
  buildVars,
  extractPlaceholders,
  unknownPlaceholders,
  TEMPLATE_VARS,
  type TemplateVar,
} from './render';
export { computePropensity } from './propensity';
