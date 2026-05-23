# Sim formulas reference

These constants and formulas were extracted from reading
[kachi-dev/uma-tools/uma-skill-tools](https://github.com/kachi-dev/uma-tools/tree/main/uma-skill-tools)
(GPLv3) for clean-room reimplementation. Formulas and numeric constants are
facts about how the game works and are not copyrightable; this doc captures
them in our own words. Our actual code is independent.

Pin: kachi-dev/uma-tools as of mid-2026 (file paths under `uma-skill-tools/`).

## Physics

**Base velocity (m/s)** — function of race distance only:
```
baseSpeed = 20.0 - (distance - 2000) / 1000.0
```
A 2000m race has baseSpeed = 20.0. A 3200m race has 18.8. A 1200m race has 20.8.

**Speed-stat contribution** (added to target in phase 2 and later):
```
speedContribution = sqrt(500 * uma.speed) * APT[aptitude] * 0.002
```

**Aptitude multiplier table** (surface/distance/style grades S → G):
```
APT = [1.05, 1.0, 0.9, 0.8, 0.6, 0.4, 0.2, 0.1]
       S     A    B    C    D    E    F    G
```
Note: G aptitude is severely punishing (0.1×).

**Acceleration**:
```
accel = BaseAccel * sqrt(500 * uma.power) * STRAT_ACCEL[strategy][phase]
        * APT[surface] * APT[distance]
BaseAccel = 0.0006   (0.0004 on uphill — slope > 1)
```

**Strategy accel coefficients** (per phase 0/1/2):
```
Nige     (runner): [1.000, 1.000, 0.996]
Senkou   (early):  [0.985, 1.000, 0.996]
Sasi     (late):   [0.975, 1.000, 1.000]
Oikomi   (end):    [0.945, 1.000, 0.997]
Oonige   (escape): [1.170, 0.940, 0.956]
```

**Strategy velocity coefficients** (per phase 0/1/2 — multiplier on baseSpeed):
```
Nige     [1.000, 0.980, 0.962]
Senkou   [0.978, 0.991, 0.975]
Sasi     [0.938, 0.998, 0.994]
Oikomi   [0.931, 1.000, 1.000]
Oonige   [1.063, 0.962, 0.950]
```

**Deceleration** (when velocity > target): per phase `[-1.2, -0.8, -1.0]`.
Pace-down state: `-0.5`.

**Start dash bonus**: `+24.0` to accel until velocity > `0.85 * baseSpeed`.

**Post-start minimum speed**: `0.85 * baseSpeed + sqrt(200 * guts) * 0.001`.

**Uphill target-speed penalty**: `target -= (slope / 10000) * 200.0 / power`.

## HP / Stamina

**HP pool**:
```
maxHp = 0.8 * HP_STRAT[strategy] * stamina + distance
HP_STRAT = [_, 0.95, 0.89, 1.0, 0.995, 0.86]   // [_, Nige, Senkou, Sasi, Oikomi, Oonige]
```

**Drain per second**:
```
hpPerSec = 20.0 * (velocity - baseSpeed + 12.0)^2 / 144.0
           * statusMod * groundMod * gutsMod
```

- `statusMod`: 1.0 normal, 0.6 paced down, 1.6 rushed/kakari, **0.4 if downhill mode active**
- `gutsMod` (phase 2+ only): `1.0 + 200.0 / sqrt(600 * guts)`
- `groundMod` (surface 1=turf, 2=dirt, indexed by ground condition Good/Yielding/Soft/Heavy):
  ```
  turf: [_, 1.00, 1.00, 1.02, 1.02]
  dirt: [_, 1.00, 1.00, 1.01, 1.02]
  ```

**Stamina-out (HP = 0)**:
- Target velocity drops to `minSpeed` (the post-start minimum)
- Accel becomes constant `-1.2`

**Heal effect**:
```
hp = min(maxHp, hp + maxHp * modifier)
```
`modifier` is pre-scaled — no division by 10000.

## Phase boundaries

Fractions of total distance:
```
Phase 0 (opening):    0      → 1/6
Phase 1 (middle):     1/6    → 2/3
Phase 2 (last):       2/3    → 5/6
Phase 3 (last spurt): 5/6    → finish
```

## Last spurt

Not a fixed trigger. At phase-2 entry, run a candidate search:
- For each candidate speed from baseSpeed up to maxSpeed in 0.1 m/s steps
- Compute `spurtDist = (excessHp / consumptionDiff) + 60` (60m buffer)
- If `maxSpurtDist >= remainingDistance` → full max-speed spurt
- Else: pick the fastest sustainable; accept subpar speeds when
  `randomRoll <= subparAcceptChance` where
  ```
  subparAcceptChance = round((15.0 + 0.05 * wit) * 1000)
  ```
  (higher wit → more consistent optimal spurt)

**Spurt target velocity** (when last-spurt flag set):
```
target = phase2Target + 0.01 * baseSpeed + 1.05_multiplier
         + pow(450 * guts, 0.597) * 0.0001
```

## Effect type codes

```
1   SpeedUp
2   StaminaUp
3   PowerUp
4   GutsUp
5   WisdomUp
9   Recovery (heal)
10  MultiplyStartDelay
14  SetStartDelay
21  CurrentSpeed (additive bump to current v, not target)
22  CurrentSpeedWithNaturalDeceleration
27  TargetSpeed     ← the common "speed skill"
31  Accel           ← the common "accel skill"
37  ActivateRandomGold
42  ExtendEvolvedDuration
```

**Duration scaling**:
```
scaledDuration = baseDuration * (distance / 1000)
                 * (rarity == Evolution ? specialSkillDurationScaling : 1)
```
`baseDuration` is in **seconds** (not deciseconds).

## Sample policies — the killer architectural insight

Conditions are NEVER evaluated per tick. Instead:

1. **Pre-resolve** each condition into a list of `Region[]` (distance intervals where it's true).
2. **Sample** trigger points from those regions using a policy (see below).
3. Each sampled trigger becomes a **10-unit-wide window** on the course.
4. During simulation, just check if `position` is inside any active window.

**Policies**:
- `ImmediatePolicy` — first region's start (deterministic conditions: `is_lastspurt`, `phase>=2`)
- `RandomPolicy` — weight by region length (uniform over distance)
- `StraightRandomPolicy` — equal probability per region, then random point within
- `AllCornerRandomPolicy` — up to 4 chronologically-ordered triggers
- `UniformRandomPolicy`, `LogNormalRandomPolicy` (Box-Muller), `ErlangRandomPolicy`
- `createFixedPositionPolicy(pos)` — exact distance override

**Policy combination** (when conditions use `&` or `@`): double-dispatch precedence
Immediate > StraightRandom/AllCornerRandom > distribution-based. Some pairs throw.

To get expected behavior over randomness: **sample N trigger sets**, run the sim N times, average results. The README author runs ~100 samples.

## Tick size

Variable timestep — `step(dt)` takes any dt. Downhill RNG rolls happen at 15 FPS
(`floor(accumulatetime * 15)`), so dt ≈ 1/15 s is the practical cadence.

## Region width

Trigger windows are **10m wide** centered on the sampled point. Gives the
tick loop something concrete to hit even with small dt.

## Position-keep / kakari state machine

States: None, PaceUp, PaceDown, SpeedUp, Overtake.

```
courseFactor = 0.0008 * (distance - 1000) + 1.0
```

Wit-roll triggers:
- SpeedUp: `rng < 0.2 * log10(0.1 * wit)`
- PaceUp:  `rng < 0.15 * log10(0.1 * wit)`

Speed multipliers:
- SpeedUp / PaceUp = `1.04`
- Overtake = `1.05`
- PaceDown = `0.915`

## Downhill mode

Per-second RNG roll (not automatic on slope):
- Enter: `rng < wit * 0.0004`
- Exit:  `rng < 0.2`

While active:
- HP drain × 0.4
- Target speed gets `+ 0.3 + |slope/10000| / 10`

## Condition parser specifics

Pratt parser, precedence: `&` (AND) = 20, `@` (OR) = 10. **No parentheses**.
So `a & b @ c & d` parses as `(a & b) @ (c & d)` — our parser already matches.

Operators: `==` `!=` `<` `<=` `>` `>=` `&` `@`.

## Condition variables our v1 doesn't yet model

(Beyond order/order_rate/phase/distance_rate/remain_distance/is_finalcorner/
is_last_straight/is_lastspurt/is_overtake/running_style/distance_type/
ground_type/course_distance/track_id/base_stats/phase_random+variants/
distance_diff_top/bashin_diff_*/change_order_onetime/corner/slope.)

**Skill chaining**:
`activate_count_all`, `activate_count_start/middle/end_after`, `activate_count_heal`,
`is_activate_other_skill_detail`, `is_used_skill_id`, `same_skill_horse_count`.

**Blocking / lane**:
`blocked_front`, `blocked_front_continuetime`, `blocked_side_continuetime`,
`blocked_all_continuetime`, `is_surrounded`, `is_move_lane`, `lane_type`,
`straight_front_type`, `behind_near_lane_time`, `infront_near_lane_time`.

**Overtake nuance**:
`overtake_target_time`, `overtake_target_no_order_up_time`,
`change_order_up_middle`, `change_order_up_finalcorner_after`,
`change_order_up_end_after`, `compete_fight_count`.

**Order-rate band conditions** (must stay in band for N seconds):
`order_rate_in20/in40/in80_continue`,
`order_rate_out20/out40/out50/out70_continue`.

**Distance**:
`distance_diff_rate`, `distance_diff_top_float`, `is_basis_distance`.

**Slope randoms**:
`up_slope_random`, `down_slope_random`, `phase_corner_random`,
`phase_straight_random`, `is_finalcorner_random`, `is_last_straight_onetime`,
`phase_firsthalf`, `phase_firstquarter`.

**Race state**:
`accumulatetime`, `random_lot`, `rotation`, `motivation`, `is_dirtgrade`,
`is_badstart`, `is_behind_in`, `is_hp_empty_onetime`, `hp_per`, `corner_count`,
`lastspurt` (raw value vs `is_lastspurt` boolean).

**Running style mix**:
`running_style_count_same/_rate`,
`running_style_count_nige/senko/sashi/oikomi_otherself`,
`running_style_equal_popularity_one`, `running_style_temptation_count_*`.

**Visibility**:
`visiblehorse`, `temptation_count_infront/behind`.

In single-uma mode (our planned v2), order/blocking/lane/overtake conditions
are pre-resolved as "always true" or with a probability distribution.

## Gotchas

1. **1D simulation** — no actual lane geometry; lane-related conditions are pre-baked windows.
2. **HpStrategyCoefficient applied to maxHp** is multiplicative with 0.8 — easy to miss the `0.8 *`.
3. **Spurt is HP-budget candidate search**, not a closed-form. Try every speed in 0.1 m/s steps.
4. **Subpar acceptance** uses raw stamina-out RNG — wit influences spurt consistency, not just skill activation.
5. **Power affects accel AND uphill resistance** — don't forget the `200/power` uphill term.
6. **Start-dash +24 accel** is huge and caps at 0.85× baseSpeed.
7. **Heal modifier is pre-scaled** — don't divide by 10000.
8. **Region width = 10m** — sampled trigger points are windows, not points.

## What we won't port

- Lane geometry / physics (single-uma mode)
- Multi-uma pack physics, drafting
- Course image rendering
- `ExtendEvolvedDuration` (effect 42) and `ActivateRandomGold` (effect 37) — niche
- The Python/Perl tooling
