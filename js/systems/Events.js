// Re-export di WorldEvents per uniformità di accesso
import { WorldEvents, getEventTranslation } from './WorldEvents.js';
export * from './WorldEvents.js';
export { WorldEvents as Events, getEventTranslation };
export default WorldEvents;
