export {
  createCampaign,
  listCampaigns,
  getCampaign,
  updateCampaign,
  deleteCampaign,
  cancelCampaign,
  CancelError,
  type CampaignInput,
} from './service';
export { launchCampaign, LaunchError, type LaunchResult } from './launch';
export { renderTemplate, buildVars, extractPlaceholders, unknownPlaceholders } from './render';
export { computePropensity } from './propensity';
