// controllers/contractsController.js
const Accrual = require("../models/Accrual");
const Contract = require("../models/Contracts");

// GET /contracts — получить список контрактов с лимитом и пагинацией
const getAllContracts = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const page = parseInt(req.query.page) || 1;

    const contracts = await Contract.find()
      .skip((page - 1) * limit)
      .limit(limit)
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: contracts,
      pagination: { page, limit },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch contracts",
      error: error.message,
    });
  }
};

// GET /contracts/:id — получить один контракт
// const getOneContract = async (req, res) => {
//   try {
//     const limit = parseInt(req.query.limit) || 50;
//     const page = parseInt(req.query.page) || 1;

//     const contract = await Contract.findById(req.params.id);
//     if (!contract) {
//       return res.status(404).json({ success: false, message: "Contract not found" });
//     }

//     // Получаем платежи (accruals)
//     const accruals = await Accrual.find({ contractId: req.params.id })
//       .skip((page - 1) * limit)
//       .limit(limit)
//       .sort({ createdAt: -1 });

//     const totalPayments = accruals.reduce((sum, acc) => sum + (acc.accrualAmount || 0), 0);

//     let totalAccruals = 0;
//     let debt = 0;

//     const moveIn = new Date(contract.moveInDate);
//     const today = new Date();

//     // Если даты выезда нет или она в будущем — считаем начисления
//     if (!contract.moveOutDate || new Date(contract.moveOutDate) >= today) {
//       const end = contract.moveOutDate ? new Date(contract.moveOutDate) : today;

//       // Разница в месяцах
//       let monthsCount = (end.getFullYear() - moveIn.getFullYear()) * 12 + (end.getMonth() - moveIn.getMonth());

//       // Если текущая дата >= дня въезда, считаем, что месяц полный и прибавляем 1
//       if (end.getDate() >= moveIn.getDate()) {
//         monthsCount += 1;
//       }

//       // Минимум 1 месяц, если уже заехал
//       if (monthsCount < 1) monthsCount = 1;

//       totalAccruals = monthsCount * (contract.contractAmount || 0);
//       debt = totalAccruals - totalPayments;
//     }

//     res.status(200).json({
//       success: true,
//       data: {
//         contract,
//         accruals,
//         totalAccruals,
//         totalPayments,
//         debt
//       }
//     });

//     console.log(contract, accruals, totalAccruals, totalPayments, debt);

//   } catch (error) {
//     res.status(500).json({
//       success: false,
//       message: "Failed to fetch contract",
//       error: error.message,
//     });
//   }
// };


const getOneContract = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const page = parseInt(req.query.page) || 1;

    const contract = await Contract.findById(req.params.id);
    if (!contract) {
      return res.status(404).json({ success: false, message: "Contract not found" });
    }

    // Получаем все платежи (accruals) без пагинации для правильного расчета долга
    const allAccruals = await Accrual.find({ contractId: req.params.id })
      .sort({ year: 1, month: 1, createdAt: 1 }); // Сортируем по году, месяцу, дате создания

    // Получаем платежи для текущей страницы
    const accruals = await Accrual.find({ contractId: req.params.id })
      .skip((page - 1) * limit)
      .limit(limit)
      .sort({ createdAt: -1 }); // Для отображения - новые сверху

    const totalPayments = allAccruals.reduce((sum, acc) => sum + (acc.accrualAmount || 0), 0);

    let totalAccruals = 0;
    let debt = 0;

    const moveIn = new Date(contract.moveInDate);
    const today = new Date();

    // Если даты выезда нет или она в будущем — считаем начисления
    if (!contract.moveOutDate || new Date(contract.moveOutDate) >= today) {
      const end = contract.moveOutDate ? new Date(contract.moveOutDate) : today;

      // Разница в месяцах
      let monthsCount = (end.getFullYear() - moveIn.getFullYear()) * 12 + (end.getMonth() - moveIn.getMonth());

      // Если текущая дата >= дня въезда, считаем, что месяц полный и прибавляем 1
      if (end.getDate() >= moveIn.getDate()) {
        monthsCount += 1;
      }

      // Минимум 1 месяц, если уже заехал
      if (monthsCount < 1) monthsCount = 1;

      totalAccruals = monthsCount * (contract.contractAmount || 0);
      debt = totalAccruals - totalPayments;
    }

    // Рассчитываем долг по месяцам
    const accrualsWithMonthlyDebt = calculateMonthlyDebt(allAccruals, contract);

    // Находим начисления для текущей страницы с рассчитанным долгом
    const paginatedAccrualsWithDebt = accruals.map(accrual => {
      const accrualWithDebt = accrualsWithMonthlyDebt.find(
        acc => acc._id.toString() === accrual._id.toString()
      );
      return {
        ...accrual.toObject(),
        monthlyDebt: accrualWithDebt ? accrualWithDebt.monthlyDebt : 0
      };
    });

    res.status(200).json({
      success: true,
      data: {
        contract,
        accruals: paginatedAccrualsWithDebt,
        totalAccruals,
        totalPayments,
        debt
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch contract",
      error: error.message,
    });
  }
};

// Функция для расчета долга по месяцам
function calculateMonthlyDebt(allAccruals, contract) {
  // Маппинг русских названий месяцев к номерам
  const monthNameToNumber = {
    'Январь': 1, 'Февраль': 2, 'Март': 3, 'Апрель': 4,
    'Май': 5, 'Июнь': 6, 'Июль': 7, 'Август': 8,
    'Сентябрь': 9, 'Октябрь': 10, 'Ноябрь': 11, 'Декабрь': 12
  };

  const numberToMonthName = {
    1: 'Январь', 2: 'Февраль', 3: 'Март', 4: 'Апрель',
    5: 'Май', 6: 'Июнь', 7: 'Июль', 8: 'Август',
    9: 'Сентябрь', 10: 'Октябрь', 11: 'Ноябрь', 12: 'Декабрь'
  };

  const moveIn = new Date(contract.moveInDate);
  const today = new Date();
  const end = contract.moveOutDate ? new Date(contract.moveOutDate) : today;

  // Создаем список месяцев от въезда до текущего момента/выезда
  const months = [];
  const current = new Date(moveIn.getFullYear(), moveIn.getMonth(), 1);
  
  while (current <= end) {
    const monthNumber = current.getMonth() + 1;
    months.push({
      year: current.getFullYear(),
      monthNumber: monthNumber,
      monthName: numberToMonthName[monthNumber],
      monthlyAccrual: contract.contractAmount || 0
    });
    current.setMonth(current.getMonth() + 1);
  }

  // Сортируем начисления по дате (конвертируем строковые месяцы в числа для сортировки)
  const sortedAccruals = [...allAccruals].sort((a, b) => {
    if (a.year !== b.year) return a.year - b.year;
    
    const monthA = typeof a.month === 'string' ? monthNameToNumber[a.month] : a.month;
    const monthB = typeof b.month === 'string' ? monthNameToNumber[b.month] : b.month;
    
    if (monthA !== monthB) return monthA - monthB;
    return new Date(a.createdAt) - new Date(b.createdAt);
  });

  // Распределяем платежи по месяцам в хронологическом порядке
  let runningDebt = 0;
  const monthlyDebts = new Map();

  // Для каждого месяца рассчитываем накопленный долг
  months.forEach(month => {
    const monthKey = `${month.year}-${month.monthName}`;
    
    // Добавляем начисление за месяц
    runningDebt += month.monthlyAccrual;
    
    // Вычитаем платежи за этот месяц
    const paymentsThisMonth = sortedAccruals.filter(acc => {
      const accMonth = typeof acc.month === 'string' ? acc.month : numberToMonthName[acc.month];
      return acc.year === month.year && accMonth === month.monthName;
    });
    
    paymentsThisMonth.forEach(payment => {
      runningDebt -= payment.accrualAmount || 0;
    });
    
    monthlyDebts.set(monthKey, runningDebt);
  });

  // Применяем рассчитанные долги к начислениям
  return sortedAccruals.map(accrual => {
    const accrualMonth = typeof accrual.month === 'string' ? accrual.month : numberToMonthName[accrual.month];
    const monthKey = `${accrual.year}-${accrualMonth}`;
    
    return {
      ...accrual.toObject(),
      monthlyDebt: monthlyDebts.get(monthKey) || 0
    };
  });
}



// POST /contracts — создать контракт
const addContract = async (req, res) => {
  try {
    const contract = await Contract.create(req.body);
    res.status(201).json({ success: true, data: contract });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: "Failed to create contract",
      error: error.message,
    });
  }
};

// PUT /contracts/:id — обновить контракт
const updateContract = async (req, res) => {
  try {
    const contract = await Contract.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!contract) {
      return res.status(404).json({ success: false, message: "Contract not found" });
    }
    res.status(200).json({ success: true, data: contract });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: "Failed to update contract",
      error: error.message,
    });
  }
};

// DELETE /contracts/:id — удалить контракт
const deleteContract = async (req, res) => {
  try {
    // Сначала удаляем все начисления, связанные с контрактом
    await Accrual.deleteMany({ contractId: req.params.id });

    // Потом удаляем сам контракт
    const deletedContract = await Contract.findByIdAndDelete(req.params.id);

    if (!deletedContract) {
      return res.status(404).json({ success: false, message: "Contract not found" });
    }

    res.status(200).json({
      success: true,
      message: "Contract deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to delete contract",
      error: error.message,
    });
  }
};


// GET /contracts/search — поиск контрактов по названию компании
const searchContracts = async (req, res) => {
  try {
    const { query } = req.query;

    if (!query || query.trim() === "") {
      return res.status(400).json({ success: false, message: "Search query is required" });
    }

    const searchRegex = new RegExp(query, "i"); // i — регистронезависимый поиск

    const contracts = await Contract.find({
      company: searchRegex // Поиск только по названию компании
    })
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: contracts,
      total: contracts.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to search contracts",
      error: error.message,
    });
  }
};


module.exports = {
  getAllContracts,
  getOneContract,
  addContract,
  updateContract,
  deleteContract,
  searchContracts,
};