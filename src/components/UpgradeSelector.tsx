import React, { useState, useEffect } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Image from 'next/image';
import { Upgrade } from './FleetBuilder';
import { useUniqueClassContext } from '../contexts/UniqueClassContext';

interface UpgradeSelectorProps {
  upgradeType: string;
  faction: string;
  onSelectUpgrade: (upgrade: Upgrade) => void;
  onClose: () => void;
  selectedUpgrades: Upgrade[];
  shipType?: string;
  chassis?: string;
  shipSize?: string;
  shipTraits?: string[];
  currentShipUpgrades: Upgrade[];
  disqualifiedUpgrades: string[];
  disabledUpgrades: string[];
  hasCommander: boolean;
}

interface UpgradeData {
  upgrades: Record<string, Upgrade>;
}

export default function UpgradeSelector({
  upgradeType,
  faction,
  onSelectUpgrade,
  onClose,
  selectedUpgrades,
  shipType,
  chassis,
  shipSize,
  shipTraits, 
  currentShipUpgrades,
  disqualifiedUpgrades,
  disabledUpgrades,
  hasCommander
}: UpgradeSelectorProps) {
  const [upgrades, setUpgrades] = useState<Upgrade[]>([]);
  const [loading, setLoading] = useState(true);
  const { uniqueClassNames, addUniqueClassName } = useUniqueClassContext();

  useEffect(() => {
    const fetchUpgrades = () => {
      setLoading(true);
      const cachedUpgrades = localStorage.getItem('upgrades');
      const cachedLegacyUpgrades = localStorage.getItem('legacyUpgrades');
      const cachedLegendsUpgrades = localStorage.getItem('legendsUpgrades');
      
      // console.log('Cached upgrades:', cachedUpgrades);
      // console.log('Cached legacy upgrades:', cachedLegacyUpgrades);
      // console.log('Cached legends upgrades:', cachedLegendsUpgrades);
      
      let allUpgrades: Upgrade[] = [];

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const processUpgrades = (data: UpgradeData, prefix: string = ''): Upgrade[] => {
        if (data && data.upgrades) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          return Object.values(data.upgrades).map((upgrade: any) => ({
            ...upgrade,
            id: prefix ? `${prefix}-${upgrade.id || upgrade.name}` : (upgrade.id || upgrade.name),
            faction: Array.isArray(upgrade.faction) ? upgrade.faction : [upgrade.faction],
            "unique-class": upgrade["unique-class"] || [],
            restrictions: {
              ...upgrade.restrictions,
              traits: upgrade.restrictions?.traits || [],
              size: upgrade.restrictions?.size || [],
              disqual_upgrades: upgrade.restrictions?.disqual_upgrades || [],
              disable_upgrades: upgrade.restrictions?.disable_upgrades || [],
              enable_upgrades: upgrade.restrictions?.enable_upgrades || [],
            },
          }));
        }
        return [];
      };

      if (cachedUpgrades) {
        const upgradeData = JSON.parse(cachedUpgrades);
        allUpgrades = [...allUpgrades, ...processUpgrades(upgradeData)];
      }

      if (cachedLegacyUpgrades) {
        const legacyUpgradeData = JSON.parse(cachedLegacyUpgrades);
        allUpgrades = [...allUpgrades, ...processUpgrades(legacyUpgradeData, 'legacy')];
      }

      if (cachedLegendsUpgrades) {
        const legendsUpgradeData = JSON.parse(cachedLegendsUpgrades);
        allUpgrades = [...allUpgrades, ...processUpgrades(legendsUpgradeData, 'legends')];
      }

      const filteredUpgrades = allUpgrades.filter(upgrade => {
        const factionMatch = Array.isArray(upgrade.faction) 
          ? upgrade.faction.includes(faction) || upgrade.faction.includes('')
          : upgrade.faction === faction || upgrade.faction === '';

        const chassisMatch = upgradeType === 'title' 
          ? upgrade.bound_shiptype === chassis
          : true;

        // console.log('Upgrade:', upgrade.name, 'Type:', upgrade.type, 'Faction:', upgrade.faction, 'Bound shiptype:', upgrade.bound_shiptype);
        // console.log('Faction match:', factionMatch, 'Chassis match:', chassisMatch);

        return upgrade.type === upgradeType &&
          factionMatch &&
          chassisMatch;
      });

      // console.log('Filtered upgrades:', filteredUpgrades);
      // console.log('Current upgradeType:', upgradeType, 'faction:', faction, 'chassis:', chassis);

      setUpgrades(filteredUpgrades);
      setLoading(false);
    };

    fetchUpgrades();
  }, [upgradeType, faction, chassis]);

  const isUpgradeAvailable = (upgrade: Upgrade) => {
    // console.log(`Checking availability for ${upgrade.name}. Ship traits: ${shipTraits?.join(', ') || 'None'}`);

    if (upgrade.type === 'commander' && hasCommander) {
      return false;
    }

    if (upgradeType === 'title') {
      if (upgrade.bound_shiptype && upgrade.bound_shiptype !== chassis) {
        return false;
      }
    } else if (upgrade.type === 'super-weapon') {
      if (upgrade.bound_shiptype && upgrade.bound_shiptype !== chassis) {
        return false;
      }
    } else {
      if (upgrade.bound_shiptype && upgrade.bound_shiptype !== shipType) {
        return false;
      }
    }

    if (upgrade.unique && selectedUpgrades.some(su => su.name === upgrade.name)) {
      return false;
    }

    if (currentShipUpgrades.some(su => su.name === upgrade.name)) {
      return false;
    }

    if (upgrade.modification && currentShipUpgrades.some(su => su.modification)) {
      return false;
    }

    if (disqualifiedUpgrades.includes(upgrade.type) || disabledUpgrades.includes(upgrade.type)) {
      return false;
    }

    if (upgrade.restrictions) {
      const disqualOrDisable = [...(upgrade.restrictions.disqual_upgrades || []), ...(upgrade.restrictions.disable_upgrades || [])];
      if (currentShipUpgrades.some(su => disqualOrDisable.includes(su.type))) {
        return false;
      }

      if (upgrade.restrictions.size && upgrade.restrictions.size.length > 0 && shipSize) {
        const validSizes = upgrade.restrictions.size.filter(size => size.trim() !== '');
        if (validSizes.length > 0 && !validSizes.includes(shipSize)) {
          return false;
        }
      }

      if (upgrade.restrictions?.traits && upgrade.restrictions.traits.length > 0 && shipTraits) {
        const validTraits = upgrade.restrictions.traits.filter(trait => trait.trim() !== '');
        if (validTraits.length > 0) {
          const hasRequiredTrait = validTraits.some(trait => shipTraits.includes(trait));
          if (!hasRequiredTrait) {
            return false;
          }
        }
      }
    }
    
    return true;
  };

  const isUpgradeGreyedOut = (upgrade: Upgrade) => {
    // Only check for unique class conflicts if the upgrade has a unique class
    if (upgrade["unique-class"] && upgrade["unique-class"].length > 0) {
      return upgrade["unique-class"].some(uc => 
        uniqueClassNames.includes(uc) && 
        !selectedUpgrades.some(su => su["unique-class"]?.includes(uc))
      );
    }
    return false; // Non-unique upgrades or upgrades without a unique class are not greyed out
  };

  const handleUpgradeClick = (upgrade: Upgrade) => {
    if (isUpgradeAvailable(upgrade) && !isUpgradeGreyedOut(upgrade)) {
      onSelectUpgrade(upgrade);
      // Only add unique class names if the upgrade has them and they're not already in the context
      if (upgrade["unique-class"] && upgrade["unique-class"].length > 0) {
        upgrade["unique-class"].forEach(uc => {
          if (!uniqueClassNames.includes(uc)) {
            addUniqueClassName(uc);
          }
        });
      }
    }
  };

  const validateImageUrl = (url: string): string => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }
    return `https://api.swarmada.wiki${url.startsWith('/') ? '' : '/'}${url}`;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <Card className="w-full h-full sm:w-11/12 sm:h-5/6 lg:w-3/4 lg:h-3/4 flex flex-col">
        <div className="p-2 sm:p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
          <h2 className="text-lg sm:text-xl lg:text-2xl font-bold">Select {upgradeType}</h2>
          <Button variant="ghost" onClick={onClose} className="p-1">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 sm:h-6 sm:w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </Button>
        </div>
        <CardContent className="p-2 sm:p-4 flex-grow overflow-auto">
          {loading ? (
            <p>Loading upgrades...</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-3 md:gap-4">
              {upgrades.map((upgrade) => (
                <div key={upgrade.name} className="w-full aspect-[2/3]">
                  <Button
                    onClick={() => handleUpgradeClick(upgrade)}
                    className={`p-0 overflow-hidden relative w-full h-full rounded-lg ${
                      !isUpgradeAvailable(upgrade) || isUpgradeGreyedOut(upgrade) ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                    disabled={!isUpgradeAvailable(upgrade) || isUpgradeGreyedOut(upgrade)}
                  >
                    <div className="absolute inset-0 bg-gray-200 flex items-center justify-center">
                      <Image
                        src={validateImageUrl(upgrade.cardimage)}
                        alt={upgrade.name}
                        fill
                        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                        className="object-cover object-center scale-[103%]"
                        onError={(e) => {
                          e.currentTarget.src = '/placeholder-upgrade.png';
                        }}
                      />
                    </div>
                    <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white p-1 sm:p-2">
                      <p className="text-xs sm:text-sm font-bold flex items-center justify-center">
                        {upgrade.unique && <span className="mr-1 text-yellow-500 text-xs sm:text-sm">●</span>}
                        <span className="break-words line-clamp-2 text-center">{upgrade.name}</span>
                      </p>
                      <p className="text-xs sm:text-sm text-center">{upgrade.points} points</p>
                    </div>
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}