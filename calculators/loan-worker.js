// Bonds Loan Calculator Web Worker
// Offloads amortization calculations for large loan terms

self.onmessage = function(e) {
  var inputs = e.data;
  var result = calculateLoan(inputs);
  self.postMessage(result);
};

function calculateLoan(inputs) {
  var netLoan = inputs.loanAmount - inputs.downPayment + inputs.extraFees;
  var isMonthly = inputs.frequency === 'monthly';
  var periodsPerYear = isMonthly ? 12 : 4;
  var totalPayments = isMonthly ? inputs.loanTerm : Math.floor(inputs.loanTerm / 3);
  if (totalPayments < 1) totalPayments = 1;
  var periodicRate = (inputs.interestRate / 100) / periodsPerYear;

  var installment = 0;
  if (periodicRate === 0) {
    installment = netLoan / totalPayments;
  } else {
    installment = netLoan * (periodicRate * Math.pow(1 + periodicRate, totalPayments)) / (Math.pow(1 + periodicRate, totalPayments) - 1);
  }

  var totalPaid = installment * totalPayments;
  var totalInterest = totalPaid - netLoan;
  var ear = Math.pow(1 + periodicRate, periodsPerYear) - 1;

  var schedule = [];
  var balance = netLoan;
  var totalPrincipalPaid = 0, totalInterestPaid = 0;
  for (var i = 1; i <= totalPayments; i++) {
    var interestPayment = balance * periodicRate;
    var principalPayment = installment - interestPayment;
    balance -= principalPayment;
    if (balance < 0) { principalPayment += balance; balance = 0; }
    totalPrincipalPaid += principalPayment;
    totalInterestPaid += interestPayment;
    schedule.push({
      period: i,
      installment: installment,
      principal: principalPayment,
      interest: interestPayment,
      balance: balance
    });
  }

  return {
    netLoan: netLoan,
    installment: installment,
    totalPaid: totalPaid,
    totalInterest: totalInterest,
    ear: ear,
    schedule: schedule,
    totalPayments: totalPayments,
    totalPrincipalPaid: totalPrincipalPaid,
    totalInterestPaid: totalInterestPaid,
    periodicRate: periodicRate,
    periodsPerYear: periodsPerYear
  };
}
