import { ScenarioData } from "./data/ScenarioData";

export class Scenario extends ScenarioData {

  custom: boolean;

  constructor(scenarioData: ScenarioData, custom: boolean = false) {
    super(scenarioData.name, scenarioData.index, scenarioData.unlocks, scenarioData.blocks, scenarioData.requires, scenarioData.links, scenarioData.monsters, scenarioData.allies, scenarioData.objectives, scenarioData.rules, scenarioData.edition, scenarioData.group, scenarioData.spoiler);
    this.solo = scenarioData.solo;
    this.custom = custom;
  }
}