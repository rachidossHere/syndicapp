import type { IssueLocation } from '@syndic/shared';
import ArrowUpDown from 'lucide-react-native/icons/arrow-up-down';
import Car from 'lucide-react-native/icons/car';
import DoorOpen from 'lucide-react-native/icons/door-open';
import Ellipsis from 'lucide-react-native/icons/ellipsis';
import Footprints from 'lucide-react-native/icons/footprints';
import House from 'lucide-react-native/icons/house';

/** Icône lucide de chaque emplacement (importées une par une, jamais depuis l'index du paquet). */
export const LOCATION_ICONS = {
  elevator: ArrowUpDown,
  stairs: Footprints,
  parking: Car,
  hall: DoorOpen,
  roof: House,
  other: Ellipsis,
} as const satisfies Record<IssueLocation, unknown>;
