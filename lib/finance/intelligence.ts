import type {
  FinanceDailyRevenue,
  FinanceDashboard,
} from "@/lib/finance/dashboard";
import type { FinanceExecutiveKpis } from "@/lib/finance/executive";

export type IntelligenceSeverity =
  "critical" | "warning" | "positive" | "information";

export type FinanceIntelligenceAlert = {
  id: string;
  title: string;
  description: string;
  severity: IntelligenceSeverity;
  href: string;
};

export type FinanceAnomaly = {
  date: string;
  actualRevenue: number;
  expectedRevenue: number;
  deviationPercentage: number;
  direction: "above" | "below";
};

export type FinanceForecastPoint = {
  period: string;
  projectedRevenue: number;
  projectedPlatformRevenue: number;
  projectedOperatingResult: number;
};

export type FinanceIntelligence = {
  averageDailyRevenue: number;
  averageDailyPlatformRevenue: number;

  recentSevenDayRevenue: number;
  previousSevenDayRevenue: number;
  sevenDayGrowthPercentage: number;

  projectedMonthlyRevenue: number;
  projectedMonthlyPlatformRevenue: number;
  projectedMonthlyOperatingResult: number;

  operatingMarginPercentage: number;
  platformTakeRatePercentage: number;
  expenseRatioPercentage: number;

  cashSharePercentage: number;
  digitalSharePercentage: number;

  volatilityPercentage: number;
  revenueTrend: "growing" | "declining" | "stable";

  anomalies: FinanceAnomaly[];
  forecast: FinanceForecastPoint[];
  alerts: FinanceIntelligenceAlert[];
};

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  return sum(values) / values.length;
}

function percentageChange(previous: number, current: number): number {
  if (previous === 0) {
    return current > 0 ? 100 : 0;
  }

  return ((current - previous) / Math.abs(previous)) * 100;
}

function safePercentage(value: number, total: number): number {
  if (total === 0) {
    return 0;
  }

  return (value / total) * 100;
}

function standardDeviation(values: number[]): number {
  if (values.length < 2) {
    return 0;
  }

  const mean = average(values);

  const variance =
    values.reduce((total, value) => {
      return total + Math.pow(value - mean, 2);
    }, 0) / values.length;

  return Math.sqrt(variance);
}

function detectAnomalies(
  dailyRevenue: FinanceDailyRevenue[],
): FinanceAnomaly[] {
  const positiveDays = dailyRevenue.filter((day) => day.grossRevenue > 0);

  const revenues = positiveDays.map((day) => day.grossRevenue);

  if (revenues.length < 5) {
    return [];
  }

  const expectedRevenue = average(revenues);
  const deviation = standardDeviation(revenues);

  if (deviation === 0) {
    return [];
  }

  return positiveDays
    .filter((day) => {
      const distance = Math.abs(day.grossRevenue - expectedRevenue);

      return distance >= deviation * 1.5;
    })
    .map((day) => ({
      date: day.date,
      actualRevenue: day.grossRevenue,
      expectedRevenue,
      deviationPercentage: percentageChange(expectedRevenue, day.grossRevenue),
      direction:
        day.grossRevenue >= expectedRevenue
          ? ("above" as const)
          : ("below" as const),
    }))
    .sort(
      (first, second) =>
        Math.abs(second.deviationPercentage) -
        Math.abs(first.deviationPercentage),
    )
    .slice(0, 6);
}

export function buildFinanceIntelligence(
  dashboard: FinanceDashboard,
  executive: FinanceExecutiveKpis,
): FinanceIntelligence {
  const activeDays = dashboard.dailyRevenue.filter(
    (day) => day.grossRevenue > 0 || day.paidPayments > 0,
  );

  const revenueValues = activeDays.map((day) => day.grossRevenue);

  const platformValues = activeDays.map((day) => day.platformCommission);

  const latestSevenDays = activeDays.slice(-7);
  const previousSevenDays = activeDays.slice(-14, -7);

  const recentSevenDayRevenue = sum(
    latestSevenDays.map((day) => day.grossRevenue),
  );

  const previousSevenDayRevenue = sum(
    previousSevenDays.map((day) => day.grossRevenue),
  );

  const sevenDayGrowthPercentage = percentageChange(
    previousSevenDayRevenue,
    recentSevenDayRevenue,
  );

  const averageDailyRevenue = average(revenueValues);

  const averageDailyPlatformRevenue = average(platformValues);

  const totalPaymentMix =
    dashboard.cashPaymentsAmount + dashboard.digitalPaymentsAmount;

  const cashSharePercentage = safePercentage(
    dashboard.cashPaymentsAmount,
    totalPaymentMix,
  );

  const digitalSharePercentage = safePercentage(
    dashboard.digitalPaymentsAmount,
    totalPaymentMix,
  );

  const operatingMarginPercentage = safePercentage(
    executive.netOperatingResult,
    executive.platformRevenue,
  );

  const platformTakeRatePercentage = safePercentage(
    executive.platformRevenue,
    executive.grossBookingValue,
  );

  const expenseRatioPercentage = safePercentage(
    executive.totalExpenses,
    executive.platformRevenue,
  );

  const revenueDeviation = standardDeviation(revenueValues);

  const volatilityPercentage = safePercentage(
    revenueDeviation,
    averageDailyRevenue,
  );

  let revenueTrend: FinanceIntelligence["revenueTrend"] = "stable";

  if (sevenDayGrowthPercentage >= 5) {
    revenueTrend = "growing";
  } else if (sevenDayGrowthPercentage <= -5) {
    revenueTrend = "declining";
  }

  const projectedMonthlyRevenue = averageDailyRevenue * 30;

  const projectedMonthlyPlatformRevenue = averageDailyPlatformRevenue * 30;

  const historicalOperatingMargin = operatingMarginPercentage / 100;

  const projectedMonthlyOperatingResult =
    projectedMonthlyPlatformRevenue * historicalOperatingMargin;

  const forecast: FinanceForecastPoint[] = [30, 60, 90].map((days) => ({
    period: `${days} días`,
    projectedRevenue: averageDailyRevenue * days,
    projectedPlatformRevenue: averageDailyPlatformRevenue * days,
    projectedOperatingResult:
      averageDailyPlatformRevenue * days * historicalOperatingMargin,
  }));

  const anomalies = detectAnomalies(activeDays);

  const alerts: FinanceIntelligenceAlert[] = [];

  if (executive.netOperatingResult < 0) {
    alerts.push({
      id: "negative-operating-result",
      title: "Resultado operativo negativo",
      description:
        "Los gastos contables superan los ingresos reconocidos por AXI.",
      severity: "critical",
      href: "/dashboard/admin/finance/statements",
    });
  }

  if (expenseRatioPercentage > 75) {
    alerts.push({
      id: "high-expense-ratio",
      title: "Presión elevada de gastos",
      description: `${expenseRatioPercentage.toFixed(
        1,
      )}% de los ingresos de plataforma está siendo absorbido por gastos.`,
      severity: "warning",
      href: "/dashboard/admin/finance/general-ledger",
    });
  }

  if (dashboard.cashDebt > 0) {
    alerts.push({
      id: "cash-debt",
      title: "Deuda en efectivo pendiente",
      description:
        "Existen saldos cobrados en efectivo que todavía deben recuperarse.",
      severity: "warning",
      href: "/dashboard/admin/finance/cash-debts",
    });
  }

  if (cashSharePercentage > 60) {
    alerts.push({
      id: "cash-concentration",
      title: "Alta dependencia del efectivo",
      description: `${cashSharePercentage.toFixed(
        1,
      )}% del volumen registrado corresponde a pagos en efectivo.`,
      severity: "information",
      href: "/dashboard/admin/finance/reconciliation",
    });
  }

  if (dashboard.pendingWithdrawals > 0) {
    alerts.push({
      id: "pending-withdrawals",
      title: "Retiros por procesar",
      description: `${dashboard.pendingWithdrawals.toLocaleString(
        "es-US",
      )} retiros permanecen abiertos.`,
      severity: "information",
      href: "/dashboard/admin/finance/withdrawals",
    });
  }

  if (dashboard.pendingRefunds > 0) {
    alerts.push({
      id: "pending-refunds",
      title: "Reembolsos pendientes",
      description: `${dashboard.pendingRefunds.toLocaleString(
        "es-US",
      )} solicitudes requieren revisión financiera.`,
      severity: "warning",
      href: "/dashboard/admin/finance/refunds",
    });
  }

  if (sevenDayGrowthPercentage >= 10) {
    alerts.push({
      id: "positive-growth",
      title: "Aceleración de ingresos",
      description: `El volumen de los últimos siete días creció ${sevenDayGrowthPercentage.toFixed(
        1,
      )}% frente al periodo anterior.`,
      severity: "positive",
      href: "/dashboard/admin/finance/executive",
    });
  }

  if (sevenDayGrowthPercentage <= -10 && previousSevenDays.length > 0) {
    alerts.push({
      id: "revenue-decline",
      title: "Caída reciente de ingresos",
      description: `El volumen de los últimos siete días disminuyó ${Math.abs(
        sevenDayGrowthPercentage,
      ).toFixed(1)}% frente al periodo anterior.`,
      severity: "critical",
      href: "/dashboard/admin/finance/reports",
    });
  }

  if (volatilityPercentage > 40) {
    alerts.push({
      id: "high-volatility",
      title: "Ingresos con alta volatilidad",
      description: `La variación diaria equivale al ${volatilityPercentage.toFixed(
        1,
      )}% del ingreso promedio.`,
      severity: "information",
      href: "/dashboard/admin/finance/reports",
    });
  }

  if (alerts.length === 0) {
    alerts.push({
      id: "stable-operation",
      title: "Operación financiera estable",
      description:
        "No se detectaron alertas importantes con la información disponible.",
      severity: "positive",
      href: "/dashboard/admin/finance/executive",
    });
  }

  return {
    averageDailyRevenue,
    averageDailyPlatformRevenue,

    recentSevenDayRevenue,
    previousSevenDayRevenue,
    sevenDayGrowthPercentage,

    projectedMonthlyRevenue,
    projectedMonthlyPlatformRevenue,
    projectedMonthlyOperatingResult,

    operatingMarginPercentage,
    platformTakeRatePercentage,
    expenseRatioPercentage,

    cashSharePercentage,
    digitalSharePercentage,

    volatilityPercentage,
    revenueTrend,

    anomalies,
    forecast,
    alerts,
  };
}
