import { DialogRef, DIALOG_DATA } from "@angular/cdk/dialog";
import { Component, Inject } from "@angular/core";
import { GameManager, gameManager } from "src/app/game/businesslogic/GameManager";

import { Character } from "src/app/game/model/Character";
import { SummonData } from "src/app/game/model/data/SummonData";
import { EntityValueFunction } from "src/app/game/model/Entity";
import { Summon, SummonColor, SummonState } from "src/app/game/model/Summon";

@Component({
  selector: 'ghs-character-summondialog',
  templateUrl: 'summondialog.html',
  styleUrls: ['./summondialog.scss']
})
export class CharacterSummonDialog {

  gameManager: GameManager = gameManager;
  summonColors: SummonColor[] = Object.values(SummonColor).filter((summonColor) => summonColor != SummonColor.custom);
  summonColor: SummonColor = SummonColor.blue;
  summonNumber: number = 1;
  summonName: string = "";

  constructor(@Inject(DIALOG_DATA) public character: Character, private dialogRef: DialogRef) { }

  pickNumber(number: number) {
    this.summonNumber = number;
  }

  selectColor(color: SummonColor) {
    this.summonColor = color;
  }

  available(summonData: SummonData) {
    return this.summonColor != SummonColor.custom && this.summonNumber != 0 && this.character.summons.every((summon) => summon.dead || summon.name != summonData.name || (summonData.special ? summon.number != 0 : summon.number != this.summonNumber) || (summonData.special ? summon.color != SummonColor.custom : summon.color != this.summonColor)) && (summonData.count || 1) > this.character.summons.filter((summon) => summon.name == summonData.name && !summon.dead && summon.health > 0).length
  }

  customDisabled() {
    return this.character.summons.some((summon) => !summon.dead && summon.name == this.summonName && summon.number == this.summonNumber && summon.color == this.summonColor);
  }

  summonData(): SummonData[] {
    let summons: SummonData[] = [];
    summons.push(...this.character.availableSummons.filter((summonData) => !summonData.level || summonData.level <= this.character.level));

    if (this.character.progress && this.character.progress.items) {
      for (let itemIdentifier of this.character.progress.items) {
        const item = gameManager.item(+itemIdentifier.name, itemIdentifier.edition);
        if (item && item.summon) {
          if (!item.summon.name) {
            item.summon.name = item.name;
          }
          if (!item.summon.count) {
            item.summon.count = 1;
          }
          summons.push(item.summon);
        }
      }
    }

    return summons;
  }

  setSummonName(event: any) {
    this.summonName = event.target.value;
  }

  addCustomSummon() {
    let summon: Summon = new Summon(this.summonName, this.character.level, this.summonNumber, this.summonColor);
    summon.state = SummonState.new;
    gameManager.characterManager.addSummon(this.character, summon);
    this.dialogRef.close();
  }

  addSummon(summonData: SummonData) {
    if (this.summonData().indexOf(summonData) != -1) {
      gameManager.stateManager.before("addSummon", "data.character." + this.character.name, "data.summon." + summonData.name);
      let summon: Summon = new Summon(summonData.name, this.character.level, summonData.special ? 0 : this.summonNumber, summonData.special ? SummonColor.custom : this.summonColor);
      summon.maxHealth = typeof summonData.health == "number" ? summonData.health : EntityValueFunction(summonData.health, this.character.level);
      summon.attack = typeof summonData.attack == "number" ? summonData.attack : EntityValueFunction(summonData.attack, this.character.level);
      summon.movement = typeof summonData.movement == "number" ? summonData.movement : EntityValueFunction(summonData.movement, this.character.level);
      summon.range = typeof summonData.range == "number" ? summonData.range : EntityValueFunction(summonData.range, this.character.level);
      summon.health = summon.maxHealth;
      if (summonData.special) {
        summon.state = SummonState.true;
      } else {
        summon.state = SummonState.new;
      }
      summon.init = false;
      gameManager.characterManager.addSummon(this.character, summon);
      this.dialogRef.close();
      gameManager.stateManager.after();
    }
  }

}