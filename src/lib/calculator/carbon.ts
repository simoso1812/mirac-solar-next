/**
 * Carbon emissions calculator — ported from carbon_calculator.py
 */
import { EMISSION_FACTORS } from '@/lib/constants'
import type { CarbonMetrics } from '@/lib/types'

const EQUIVALENCY_FACTORS = EMISSION_FACTORS.equivalency_factors

function getGridEmissionFactor(region: string): number {
  const key = region.toUpperCase().trim()
  return (
    EMISSION_FACTORS.colombia_grid.by_region[key] ??
    EMISSION_FACTORS.colombia_grid.national_average
  )
}

function emptyCarbon(): CarbonMetrics {
  return {
    annual_co2_avoided_kg: 0,
    annual_co2_avoided_tons: 0,
    lifetime_co2_avoided_kg: 0,
    lifetime_co2_avoided_tons: 0,
    trees_saved_per_year: 0,
    cars_off_road_per_year: 0,
    homes_powered_per_year: 0,
    flights_avoided_per_year: 0,
    annual_certification_value_cop: 0,
    lifetime_certification_value_cop: 0,
    emission_factor_used: 0,
    region: 'N/A',
    system_lifetime_years: 25,
    plastic_bottles_avoided_per_year: 0,
    smartphone_charges_avoided_per_year: 0,
  }
}

export function calculateEmissionsAvoided(
  annualGenerationKwh: number,
  region: string = 'BOGOTA',
  systemLifetimeYears: number = 25
): CarbonMetrics {
  if (annualGenerationKwh <= 0) return emptyCarbon()

  const emissionFactor = getGridEmissionFactor(region)

  const totalKg = annualGenerationKwh * emissionFactor * systemLifetimeYears
  const totalTons = totalKg / 1000

  const annualKg = annualGenerationKwh * emissionFactor
  const annualTons = annualKg / 1000

  // Equivalencies (over lifetime)
  const treesSaved = totalKg / (EQUIVALENCY_FACTORS.tree_co2_absorption_kg_per_year * systemLifetimeYears)
  const carsOffRoad = totalKg / (EQUIVALENCY_FACTORS.car_emissions_kg_per_year * systemLifetimeYears)
  const homesPowered = annualGenerationKwh / EQUIVALENCY_FACTORS.home_electricity_kwh_per_year
  const flightsAvoided = totalKg / (EQUIVALENCY_FACTORS.flight_emissions_kg_per_km * 2 * 3960)
  const plasticBottles = totalKg / EQUIVALENCY_FACTORS.plastic_bottle_co2_kg
  const smartphoneCharges = totalKg / EQUIVALENCY_FACTORS.smartphone_charge_co2_kg

  // Certification value
  const copPerTon = EMISSION_FACTORS.certification_rates.carbon_credit_cop_per_ton
  const annualCertCop = (totalTons / systemLifetimeYears) * copPerTon
  const lifetimeCertCop = totalTons * copPerTon

  return {
    annual_co2_avoided_kg: annualKg,
    annual_co2_avoided_tons: annualTons,
    lifetime_co2_avoided_kg: totalKg,
    lifetime_co2_avoided_tons: totalTons,
    trees_saved_per_year: treesSaved,
    cars_off_road_per_year: carsOffRoad,
    homes_powered_per_year: homesPowered,
    flights_avoided_per_year: flightsAvoided,
    annual_certification_value_cop: annualCertCop,
    lifetime_certification_value_cop: lifetimeCertCop,
    emission_factor_used: emissionFactor,
    region,
    system_lifetime_years: systemLifetimeYears,
    plastic_bottles_avoided_per_year: plasticBottles,
    smartphone_charges_avoided_per_year: smartphoneCharges,
  }
}
