export interface Agent {
  name: string;
  in_game: boolean;
  viewerPort: number;
  socket_connected: boolean;
}

export interface GameplayState {
  health: number;
  healthMax: number;
  hunger: number;
  hungerMax: number;
  position: { x: number; y: number; z: number };
  biome: string;
  gamemode: string;
}

export interface InventoryState {
  stacksUsed: number;
  totalSlots: number;
  equipment: {
    mainHand?: string;
    helmet?: string;
    chestplate?: string;
    leggings?: string;
    boots?: string;
  };
  counts: Record<string, number>;
}

export interface AgentFullState {
  gameplay?: GameplayState;
  inventory?: InventoryState;
  action?: { current: string };
  error?: string;
}

export interface SettingsSpecEntry {
  type: string;
  default: any;
  required?: boolean;
  description?: string;
}

export type SettingsSpec = Record<string, SettingsSpecEntry>;

