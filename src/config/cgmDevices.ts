/**
 * CGM Device Catalog
 * Defines all supported CGM devices and their connection methods.
 * Used by PatientPortalCGMConnect and provider CGM configuration UI.
 */

export interface CGMDevice {
  id: string;
  brand: string;
  model: string;
  displayName: string;
  connectionMethod: 'dexcom_share' | 'nightscout' | 'libre_linkup';
  setupInstructions: string;
  helpUrl?: string;
}

export const CGM_DEVICES: CGMDevice[] = [
  // Direct Dexcom Share connections
  {
    id: 'dexcom_g6',
    brand: 'Dexcom',
    model: 'G6',
    displayName: 'Dexcom G6',
    connectionMethod: 'dexcom_share',
    setupInstructions: 'Enter your Dexcom Share username (email or phone number) and password. Make sure "Share" is enabled in your Dexcom G6 app under Settings > Share.',
  },
  {
    id: 'dexcom_g7',
    brand: 'Dexcom',
    model: 'G7',
    displayName: 'Dexcom G7',
    connectionMethod: 'dexcom_share',
    setupInstructions: 'Enter your Dexcom Share username (email or phone number) and password. Make sure "Share" is enabled in your Dexcom G7 app under Connections > Share.',
  },
  {
    id: 'dexcom_stelo',
    brand: 'Dexcom',
    model: 'Stelo',
    displayName: 'Dexcom Stelo',
    connectionMethod: 'dexcom_share',
    setupInstructions: 'Enter your Dexcom account username and password. Stelo uses the same Dexcom Share platform as G6/G7.',
  },
  // Direct LibreLinkUp connections (FreeStyle Libre)
  {
    id: 'libre_2',
    brand: 'Abbott',
    model: 'FreeStyle Libre 2',
    displayName: 'FreeStyle Libre 2',
    connectionMethod: 'libre_linkup',
    setupInstructions: 'Enter your LibreLinkUp email and password. Make sure you have the LibreLinkUp app set up and connected to your FreeStyle Libre 2 sensor.',
    helpUrl: 'https://www.librelinkup.com/',
  },
  {
    id: 'libre_3',
    brand: 'Abbott',
    model: 'FreeStyle Libre 3',
    displayName: 'FreeStyle Libre 3',
    connectionMethod: 'libre_linkup',
    setupInstructions: 'Enter your LibreLinkUp email and password. Make sure you have the LibreLinkUp app set up and connected to your FreeStyle Libre 3 sensor.',
    helpUrl: 'https://www.librelinkup.com/',
  },
  // Nightscout bridge connections
  {
    id: 'libre_nightscout',
    brand: 'Abbott',
    model: 'FreeStyle Libre (Nightscout)',
    displayName: 'FreeStyle Libre (via Nightscout)',
    connectionMethod: 'nightscout',
    setupInstructions: 'If you already have a Nightscout server running for your Libre, you can connect through Nightscout instead. Enter your Nightscout URL and API secret below.',
    helpUrl: 'https://nightscout.github.io/uploader/setup/',
  },
  {
    id: 'eversense_e3',
    brand: 'Senseonics',
    model: 'Eversense E3',
    displayName: 'Eversense E3',
    connectionMethod: 'nightscout',
    setupInstructions: 'Eversense requires the ESEL app to bridge data to a Nightscout server. Set up ESEL + Nightscout, then enter your Nightscout URL and API secret below.',
    helpUrl: 'https://github.com/BernhardRo/Esel',
  },
  {
    id: 'medtronic_guardian',
    brand: 'Medtronic',
    model: 'Guardian',
    displayName: 'Medtronic Guardian',
    connectionMethod: 'nightscout',
    setupInstructions: 'Medtronic Guardian requires a Nightscout server with the MiniMed 600 series uploader. Enter your Nightscout URL and API secret below.',
  },
  {
    id: 'other_nightscout',
    brand: 'Other',
    model: 'Other CGM',
    displayName: 'Other CGM (via Nightscout)',
    connectionMethod: 'nightscout',
    setupInstructions: 'If you have a Nightscout instance running for any CGM device, enter your Nightscout URL and API secret to connect.',
  },
];

export const DEXCOM_DEVICES = CGM_DEVICES.filter(d => d.connectionMethod === 'dexcom_share');
export const LIBRE_LINKUP_DEVICES = CGM_DEVICES.filter(d => d.connectionMethod === 'libre_linkup');
export const NIGHTSCOUT_DEVICES = CGM_DEVICES.filter(d => d.connectionMethod === 'nightscout');
