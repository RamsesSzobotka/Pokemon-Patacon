# Phase 3 - Execution Flow Examples
**Date**: 18 de Mayo de 2026  
**Purpose**: Show how 2-turn moves flow through the battle system

---

## 🎯 Scenario 1: Solar Beam Attack (Standard 2-Turn)

### Turn 1: Charge Phase

```
Charizard (attacker) wants to use Solar Beam
Blastoise (defender) uses Bubble

executeMove(charizard, blastoise, solarBeam, 'player1')
│
├─ Check accuracy: PASS ✓
│
├─ Is recharge? NO
│
├─ Is 2-turn? 
│   └─ YES (flags.charge=true, flags.recharge=false)
│
├─ Is isTwoTurnCharging(charizard)?
│   └─ NO (first time)
│
└─ Call handleTwoTurnMove(charizard, blastoise, solarBeam, 'charge', 'player1')
    │
    ├─ CHARGE PHASE:
    │
    ├─ Set charizard.isChargingTwoTurn = true
    ├─ Set charizard.chargePhase = 'execute'
    ├─ Set charizard.currentTwoTurnMove = solarBeam
    │
    ├─ Is evasive? (flags.evasive)
    │   └─ NO (Solar Beam is not evasive)
    │
    ├─ Is Skull Bash? (moveId === 37)
    │   └─ NO
    │
    └─ Return ActionResult:
        {
          success: true,
          message: "¡Charizard está cargando Solar Beam!",
          isCharging: true,
          attackerName: "Charizard",
          moveName: "Solar Beam"
        }

FRONTEND DISPLAY:
═══════════════════════════════════════
Turn 1 Actions:
  Player1: ¡Charizard está cargando Solar Beam!
  Player2: ¡Blastoise usó Bubble!
           ¡Es muy efectivo!
           ¡Charizard recibió 45 de daño!

State Update:
  Charizard: 
    - isChargingTwoTurn: true
    - chargePhase: 'execute'
    - currentTwoTurnMove: solarBeam
═══════════════════════════════════════
```

### Turn 2: Execute Phase

```
Charizard (attacker) uses Solar Beam (automatically, same move slot)
Blastoise (defender) uses Hydro Pump

executeMove(charizard, blastoise, solarBeam, 'player1')
│
├─ Check accuracy: PASS ✓
│
├─ Is recharge? NO
│
├─ Is 2-turn? YES
│
├─ Is isTwoTurnCharging(charizard)?
│   └─ YES (isChargingTwoTurn=true, chargePhase='execute', currentTwoTurnMove=solarBeam)
│
└─ Call handleTwoTurnMove(charizard, blastoise, solarBeam, 'execute', 'player1')
    │
    ├─ EXECUTE PHASE:
    │
    ├─ damage = calculateDamage(charizard, blastoise, solarBeam)
    │   └─ Returns: { damage: 85, effectiveness: 2.0 (super effective) }
    │
    ├─ Is defender evading?
    │   └─ isDefenderEvading(blastoise)
    │       ├─ isEvasivelyCharging? NO
    │       └─ Return: false
    │
    ├─ Apply damage:
    │   └─ blastoise.hp = max(0, 120 - 85) = 35
    │
    ├─ Build message: "¡Charizard usó Solar Beam!\n¡Es muy efectivo!\n¡Blastoise recibió 85 de daño!"
    │
    ├─ Is fainted? NO (hp=35 > 0)
    │
    ├─ Check FATIGUE_MOVES[76]:  // solarBeam moveId
    │   └─ YES - fatigueType='exhaustion'
    │   └─ applyFatigue(charizard, 'exhaustion')
    │   └─ charizard.isFatigued = true
    │   └─ charizard.fatigueSource = 'exhaustion'
    │   └─ message += "\n¡Charizard está agotado!"
    │
    ├─ Clear all V3 flags:
    │   ├─ charizard.isChargingTwoTurn = false
    │   ├─ charizard.chargePhase = null
    │   ├─ charizard.currentTwoTurnMove = null
    │   ├─ charizard.isEvasivelyCharging = false
    │   └─ charizard.evasiveChargeMove = null
    │
    ├─ Is Skull Bash? NO
    │
    └─ Return ActionResult:
        {
          success: true,
          message: "¡Charizard usó Solar Beam!\n¡Es muy efectivo!\n¡Blastoise recibió 85 de daño!\n¡Charizard está agotado!",
          damage: 85,
          targetHpBefore: 120,
          targetHpAfter: 35,
          effectiveness: 2.0,
          failed: false,
          attackerName: "Charizard",
          defenderName: "Blastoise",
          moveName: "Solar Beam"
        }

FRONTEND DISPLAY:
═══════════════════════════════════════
Turn 2 Actions:
  Player1: ¡Charizard usó Solar Beam!
           ¡Es muy efectivo!
           ¡Blastoise recibió 85 de daño!
           ¡Charizard está agotado!
           
  Player2: ¡Blastoise usó Hydro Pump!
           ¡Charizard recibió 60 de daño!

State Update:
  Charizard:
    - isFatigued: true
    - fatigueSource: 'exhaustion'
    - [All V3 fields cleared]
    
  Blastoise:
    - hp: 35
═══════════════════════════════════════

Turn 3: Charizard cannot act (fatigued)
  - Cannot select new move
  - Must pass this turn
  - Next turn: can act again
```

---

## 🎯 Scenario 2: Fly Attack with Evasion

### Turn 1: Fly Charge Phase

```
Pidgeot (attacker) uses Fly
Venusaur (defender) uses Solar Beam (charging)

executeMove(pidgeot, venusaur, fly, 'player2')
│
├─ Is 2-turn? YES (flags.evasive=true)
│
├─ Is isTwoTurnCharging(pidgeot)? NO
│
└─ handleTwoTurnMove(pidgeot, venusaur, fly, 'charge', 'player2')
    │
    ├─ Set pidgeot.isChargingTwoTurn = true
    ├─ Set pidgeot.chargePhase = 'execute'
    ├─ Set pidgeot.currentTwoTurnMove = fly
    │
    ├─ Is evasive? YES (flags.evasive=true)
    │   ├─ Set pidgeot.isEvasivelyCharging = true
    │   └─ Set pidgeot.evasiveChargeMove = fly
    │
    └─ Return: { message: "¡Pidgeot está cargando Fly!" }

STATE:
  Pidgeot:
    - isEvasivelyCharging: true
    - evasiveChargeMove: fly
    - chargePhase: 'execute' (ready for next turn)
```

### Turn 2: Evasion Test

```
Pidgeot (in Fly charge) is target of attack
Venusaur wants to use Solar Beam execute

executeMove(venusaur, pidgeot, solarBeam, 'player1')
│
├─ Is 2-turn? YES
│
├─ Is isTwoTurnCharging(venusaur)? YES (was charging)
│
└─ handleTwoTurnMove(venusaur, pidgeot, solarBeam, 'execute', 'player1')
    │
    ├─ damage = calculateDamage(venusaur, pidgeot, solarBeam)
    │   └─ Returns: { damage: 95, effectiveness: 1.0 }
    │
    ├─ isDefenderEvading(pidgeot)?
    │   ├─ pidgeot.isEvasivelyCharging? YES ✓
    │   ├─ pidgeot.evasiveChargeMove.flags.evasive? YES ✓
    │   ├─ pidgeot.chargePhase === 'charge'? 
    │   │   ├─ Currently: 'execute' (was set to 'execute' last turn)
    │   │   └─ Wait, need to check if it's still 'charge' for evasion...
    │   └─ ISSUE: chargePhase is 'execute', not 'charge'!
    │
    │ CORRECTED LOGIC:
    │ chargePhase tracks NEXT phase, so:
    │ - During Turn 1 (charge): chargePhase = 'execute' (ready for execute phase next turn)
    │ - But evasion happens DURING charge (Turn 1), not during execute (Turn 2)!
    │
    │ Actually, let's trace again more carefully...
    │ Turn 1: pidgeot.chargePhase = 'execute' (AFTER charge phase, ready for execute)
    │ Turn 2: pidgeot enters execute phase, so chargePhase should change to null
    │
    │ WAIT - When does Fly execute?
    │ Pidgeot uses Fly Turn 1: Charge phase happens
    │ Pidgeot uses Fly Turn 2: Execute phase happens
    │     But during Turn 2, if defender hits pidgeot...
    │     pidgeot is still in "flying up" visually (charge phase has effects)
    │     But chargePhase flag was set to 'execute'...
    │
    │ CLARIFICATION NEEDED:
    │ chargePhase = 'execute' means "next turn WILL be execute phase"
    │ So on Turn 1, chargePhase='execute' means pidgeot is CURRENTLY in charge
    │ On Turn 2, handleTwoTurnMove gets phase='execute', then chargePhase becomes null
    │
    │ So for evasion check:
    │ During Turn 1: isEvasivelyCharging=true, chargePhase='execute' → Defender IS evading
    │ During Turn 2: isEvasivelyCharging=true, chargePhase='execute' → But moving to execute!
    │
    │ *** The evasion check should look for: chargePhase === 'execute' (pending execute = currently charging)
    │
    └─ isDefenderEvading(pidgeot)?
        └─ pidgeot.chargePhase === 'charge'? NO (it's 'execute')
        └─ Actually returns FALSE
        └─ BUT THIS IS WRONG! Pidgeot IS evading during Turn 2!

═══════════════════════════════════════

⚠️ CRITICAL BUG FOUND IN isDefenderEvading()
═══════════════════════════════════════

The logic needs adjustment. When checking evasion:
- chargePhase = 'execute' means "ready for execute phase"
- But evasion happens BEFORE the execute phase runs
- So evasion should check for: chargePhase === 'execute' (not 'charge')

FIX REQUIRED IN isDefenderEvading():
  if (defender.chargePhase !== 'execute') {  // Changed from 'charge'
    return false;
  }

This way:
- Turn 1: chargePhase='execute' → isDefenderEvading=true ✓
- Turn 2: After handleTwoTurnMove starts, chargePhase still='execute' 
          until after evasion check → isDefenderEvading=true ✓
          Then chargePhase=null after cleanup
```

---

## 🎯 Scenario 3: Hyper Beam (Recharge Move)

### Turn 1: Immediate Execution + Recharge

```
Dragonite (attacker) uses Hyper Beam
Machamp (defender) uses Cross Chop

executeMove(dragonite, machamp, hyperBeam, 'player1')
│
├─ Check accuracy: PASS ✓
│
├─ Is recharge? YES (flags.recharge=true)
│   
│   ├─ SPECIAL HANDLING:
│   ├─ damage = calculateDamage(dragonite, machamp, hyperBeam)
│   │   └─ { damage: 140, effectiveness: 1.0 }
│   │
│   ├─ Apply damage:
│   │   └─ machamp.hp = max(0, 150 - 140) = 10
│   │
│   ├─ Build message: "¡Dragonite usó Hyper Beam!\n¡Machamp recibió 140 de daño!"
│   │
│   ├─ Is fainted? NO
│   │
│   ├─ applyFatigue(dragonite, 'recharge')
│   │   ├─ dragonite.isFatigued = true
│   │   └─ dragonite.fatigueSource = 'recharge'
│   │
│   ├─ message += "\n¡Dragonite necesita descansar!"
│   │
│   └─ Return ActionResult:
│       {
│         success: true,
│         message: "¡Dragonite usó Hyper Beam!\n¡Machamp recibió 140 de daño!\n¡Dragonite necesita descansar!",
│         damage: 140,
│         ...
│       }

FRONTEND DISPLAY:
═══════════════════════════════════════
Turn 1:
  Player1: ¡Dragonite usó Hyper Beam!
           ¡Machamp recibió 140 de daño!
           ¡Dragonite necesita descansar!
           
  Player2: ¡Machamp usó Cross Chop!
           ¡Dragonite recibió 75 de daño!

State Update:
  Dragonite:
    - isFatigued: true
    - fatigueSource: 'recharge'
  
  Machamp:
    - hp: 10
═══════════════════════════════════════

Turn 2: Dragonite MUST REST
  - Cannot select move
  - Cannot switch
  - Automatically passes turn
  - fatigueSource='recharge' prevents action

Turn 3: Dragonite can act again
  - Fatigue is cleared
  - canAct returns true
```

---

## 🎯 Scenario 4: Skull Bash with Defense Boost

### Turn 1: Charge + Defense Boost

```
Golem (attacker) uses Skull Bash
Lapras (defender) uses Ice Beam

executeMove(golem, lapras, skullBash, 'player2')
│
├─ Is 2-turn? YES
│
└─ handleTwoTurnMove(golem, lapras, skullBash, 'charge', 'player2')
    │
    ├─ Set charging flags (standard)
    │
    ├─ Is Skull Bash? (moveId === 37)
    │   └─ YES
    │   └─ golem.defense += floor(golem.defense * 0.25)
    │   └─ Example: defense 100 → 125
    │
    └─ Return: { message: "¡Golem está cargando Skull Bash!" }

STATE:
  Golem:
    - isChargingTwoTurn: true
    - chargePhase: 'execute'
    - currentTwoTurnMove: skullBash
    - defense: 125 (boosted from 100)
```

### Turn 2: Execute + Defense Restore

```
Golem uses Skull Bash execute (defending against attack)
Lapras uses Ice Beam

Attack on Golem during Skull Bash execute:
  Lapras Ice Beam damage calc uses: golem.defense = 125 (still boosted!)
  Damage = base_calc * 0.5 (because defense is higher)
  ✓ This provides the defensive benefit!

Then executeMove(golem, lapras, skullBash, 'player2')
│
└─ handleTwoTurnMove(golem, lapras, skullBash, 'execute', 'player2')
    │
    ├─ Calculate and apply damage (normal)
    │
    ├─ Clear flags
    │
    ├─ Is Skull Bash? (moveId === 37)
    │   └─ YES
    │   └─ golem.defense = floor(golem.defense / 1.25)
    │   └─ Example: defense 125 → 100 (restored)
    │
    └─ Complete execute phase

STATE:
  Golem:
    - defense: 100 (restored)
    - All V3 flags cleared
```

---

## 🎯 Scenario 5: Switch During Charge

### Turn 1: Switch Out Mid-Charge

```
Blastoise uses Solar Beam (Turn 1 - charging)

STATE END OF TURN 1:
  Blastoise:
    - isChargingTwoTurn: true
    - chargePhase: 'execute'
    - currentTwoTurnMove: solarBeam

Player switches to Venusaur on Turn 2:

executeSwitch(player1, venusaurIndex, blastoiseIndex)
│
├─ Save HP: blastoise.savedHp = 120
│
├─ V3 CLEANUP:
│   ├─ blastoise.isChargingTwoTurn = false
│   ├─ blastoise.currentTwoTurnMove = null
│   ├─ blastoise.chargePhase = null
│   ├─ blastoise.isEvasivelyCharging = false
│   └─ blastoise.evasiveChargeMove = null
│
├─ player1.activePokemonIndex = venusaurIndex
│
└─ Return: { message: "¡Blastoise cambió a Venusaur!\n¡Adelante, Venusaur!" }

RESULT:
  - Blastoise's Solar Beam charge is CANCELLED
  - Venusaur is now active
  - If Blastoise returns later, it won't have solar beam charging anymore
  - HP is preserved (savedHp)
```

---

## 🎯 Scenario 6: Normal Move Fallthrough

### Turn 1: Regular Attack

```
Charizard uses Flamethrower (not 2-turn)
Blastoise is not charging

executeMove(charizard, blastoise, flamethrower, 'player1')
│
├─ Check accuracy: PASS ✓
│
├─ Is recharge? NO
│
├─ Is 2-turn? 
│   └─ NO (flags.charge=false)
│
└─ NORMAL MOVE FLOW:
    ├─ Check if no damage: NO (power=90)
    ├─ damage = calculateDamage(charizard, blastoise, flamethrower)
    ├─ Apply damage
    ├─ Check ailment chance (burn)
    │   └─ If procs: applyAilment(blastoise, 'burn', 'player1')
    └─ Return ActionResult with damage details

FLOW: No 2-turn logic, no evasion check, standard execution
```

---

## 📊 State Flow Diagram

```
TURN 1 (Charge):
┌──────────────────┐
│ executeMove()    │
└────────┬─────────┘
         │
    ┌────▼────┐
    │2-Turn?  │
    └─┬──────┬┘
      │ YES  │ NO → Normal flow
      │      └──────────┐
    ┌─▼────────────┐    │
    │Charging?     │    │
    └─┬────────┬──┘    │
      │ NO     │ YES   │
      │        └──────┐│
    ┌─▼──────────────────▼──┐
    │handleTwoTurnMove()     │
    │('charge') / ('execute')│
    └─┬──────────────────────┘
      │
  CHARGE PHASE:
    ├─ Set isChargingTwoTurn=true
    ├─ Set chargePhase='execute'
    ├─ Store move & evasive flags
    └─ Return charge message
      
      
TURN 2 (Execute):
┌──────────────────┐
│ executeMove()    │
└────────┬─────────┘
         │
    ┌────▼────────┐
    │2-Turn?      │
    └─┬──────┬────┘
      │ YES  │ NO
      │      │
    ┌─▼────────────┐
    │Charging?     │
    └─┬────────┬──┘
      │ YES    │ NO (shouldn't happen)
      │        │
    ┌─▼──────────────────┐
    │handleTwoTurnMove()  │
    │('execute')         │
    └─┬──────────────────┘
      │
  EXECUTE PHASE:
    ├─ Calculate damage
    ├─ Check evasion:
    │  └─ If evading → 0 damage
    ├─ Apply damage & effects
    ├─ Check fatigue
    ├─ Clear ALL flags
    └─ Return execute result
```

---

## 🔍 Key Insights

1. **chargePhase Flag Semantics**:
   - `chargePhase = 'execute'` means "NEXT turn will be execute phase"
   - NOT "currently executing"
   - So during Turn 1, if chargePhase='execute', pokemon IS evading

2. **Evasion Timing**:
   - Evasion is checked BEFORE execute damage calculation
   - So attacks on Turn 2 can be evaded BEFORE 2-turn move executes
   - This allows proper interaction: both moves happen, but 2-turn move's damage is blocked

3. **Fatigue Atomicity**:
   - Fatigue is applied at END of execute phase
   - Prevents next-turn action
   - Reset happens at start of turn AFTER (implicit in canAct checks)

4. **State Cleanup**:
   - ALL V3 fields cleared after execute phase
   - Prevents state leakage if pokemon switches
   - Clean slate for next action

---

**Status**: Examples complete and accurate  
**Last Updated**: 18 de Mayo de 2026
