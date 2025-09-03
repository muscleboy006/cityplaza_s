// controllers/contractsController.js
const Accrual = require("../models/Accrual");
const Contract = require("../models/Contracts");

// GET /contracts — получить список контрактов с лимитом и пагинацией
const getAllContractsNotArch = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const page = parseInt(req.query.page) || 1;
    const year = parseInt(req.query.year); // Получаем год из query параметров

    // Базовый запрос для контрактов
    // let contractQuery = {};
     // Базовый запрос для контрактов - исключаем архивные
     let contractQuery = {
      isArchive: { $ne: true } // Исключаем архивные контракты
    };
    
    // Если год указан, добавляем фильтрацию
    if (year) {
      const startOfYear = new Date(year, 0, 1); // 1 января указанного года
      const endOfYear = new Date(year + 1, 0, 1); // 1 января следующего года
      
      contractQuery = {
        isArchive: { $ne: true },
        $or: [
          // Контракты, которые начались в указанном году
          {
            moveInDate: {
              $gte: startOfYear,
              $lt: endOfYear
            }
          },
          // Контракты, которые были активны в указанном году
          {
            moveInDate: { $lt: endOfYear },
            $or: [
              { moveOutDate: { $gte: startOfYear } },
              { moveOutDate: null } // Контракты без даты окончания (текущие)
            ]
          }
        ]
      };
    }

    const contracts = await Contract.find(contractQuery)
      .skip((page - 1) * limit)
      .limit(limit)
      .sort({ createdAt: -1 });

    // ===== Вспомогательные функции =====
    function daysInMonth(year, month) {
      return new Date(year, month + 1, 0).getDate();
    }

    function calculateAccrual(moveInDate, moveOutDate, monthlyAmount, filterYear = null) {
      if (!moveInDate) return 0;

      const today = new Date();
      let start = new Date(moveInDate);
      let end = moveOutDate ? new Date(moveOutDate) : today;

      // Если указан год для фильтрации, ограничиваем расчет этим годом
      if (filterYear) {
        const yearStart = new Date(filterYear, 0, 1);
        const yearEnd = new Date(filterYear + 1, 0, 1);
        
        // Если контракт начался позже конца года или закончился до начала года
        if (start >= yearEnd || end < yearStart) return 0;
        
        // Ограничиваем период расчета указанным годом
        start = start < yearStart ? yearStart : start;
        end = end > yearEnd ? new Date(yearEnd.getTime() - 1) : end; // -1 мс, чтобы не включать первый день следующего года
      }

      if (end < start) return 0;

      if (start.getFullYear() === end.getFullYear() && start.getMonth() === end.getMonth()) {
        return ((end.getDate() - start.getDate() + 1) / daysInMonth(start.getFullYear(), start.getMonth())) * monthlyAmount;
      }

      const fullMonths = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth()) - 1;

      const firstMonthDays = daysInMonth(start.getFullYear(), start.getMonth());
      const firstMonthAccrual = ((firstMonthDays - start.getDate() + 1) / firstMonthDays) * monthlyAmount;

      const lastMonthDays = daysInMonth(end.getFullYear(), end.getMonth());
      const lastMonthAccrual = (end.getDate() / lastMonthDays) * monthlyAmount;

      return firstMonthAccrual + (fullMonths > 0 ? fullMonths * monthlyAmount : 0) + lastMonthAccrual;
    }

    // ===== Получаем самый старый год в базе =====
    const oldestContract = await Contract.findOne(
      { moveInDate: { $exists: true, $ne: null } },
      { moveInDate: 1 }
    ).sort({ moveInDate: 1 });

    const oldestAccrual = await Accrual.findOne(
      { year: { $exists: true, $ne: null } },
      { year: 1 }
    ).sort({ year: 1 });

    // Определяем самый старый год из контрактов и начислений
    let oldestYear = null;
    if (oldestContract && oldestContract.moveInDate) {
      oldestYear = new Date(oldestContract.moveInDate).getFullYear();
    }
    if (oldestAccrual && oldestAccrual.year) {
      const accrualYear = oldestAccrual.year;
      oldestYear = oldestYear ? Math.min(oldestYear, accrualYear) : accrualYear;
    }

    // Создаем список годов от самого старого до текущего
    const availableYears = [];
    if (oldestYear) {
      const currentYear = new Date().getFullYear();
      for (let year = oldestYear; year <= currentYear; year++) {
        availableYears.push(year);
      }
    }

    // ===== Обрабатываем каждый контракт =====
    const result = [];
    for (const contract of contracts) {
      // Базовый запрос для начислений
      let accrualQuery = { contractId: contract._id };
      
      // Если указан год, фильтруем начисления по году
      if (year) {
        accrualQuery.year = year;
      }

      // все начисления (для расчётов)
      const allAccruals = await Accrual.find(accrualQuery)
        .sort({ year: 1, month: 1, createdAt: 1 });

      // только часть начислений (для списка)
      const accruals = await Accrual.find(accrualQuery)
        .limit(10) // например, 10 последних начислений
        .sort({ createdAt: -1 });

      const totalPayments = allAccruals.reduce((sum, acc) => sum + (acc.accrualAmount || 0), 0);

      // Рассчитываем начисления с учетом года (если указан)
      const totalAccruals = calculateAccrual(
        contract.moveInDate,
        contract.moveOutDate,
        contract.contractAmountMinus12 || 0,
        year // Передаем год для фильтрации расчета
      );

      const debt = totalAccruals - totalPayments;

      result.push({
        contract,
        accruals,
        totalAccruals,
        totalPayments,
        debt
      });
    }

    // Получаем общее количество контрактов для пагинации
    const totalContracts = await Contract.countDocuments(contractQuery);

    res.status(200).json({
      success: true,
      data: result,
      pagination: { 
        page, 
        limit, 
        total: totalContracts,
        totalPages: Math.ceil(totalContracts / limit)
      },
      filters: {
        year: year || null,
        availableYears: availableYears
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch contracts",
      error: error.message,
    });
  }
};

const getAllContractsArch = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const page = parseInt(req.query.page) || 1;
    const year = parseInt(req.query.year); // Получаем год из query параметров

    // Базовый запрос для контрактов
    // let contractQuery = {};
     // Базовый запрос для контрактов - исключаем архивные
     let contractQuery = {
      isArchive: { $ne: false } // Исключаем архивные контракты
    };
    
    // Если год указан, добавляем фильтрацию
    if (year) {
      const startOfYear = new Date(year, 0, 1); // 1 января указанного года
      const endOfYear = new Date(year + 1, 0, 1); // 1 января следующего года
      
      contractQuery = {
        isArchive: { $ne: false },
        $or: [
          // Контракты, которые начались в указанном году
          {
            moveInDate: {
              $gte: startOfYear,
              $lt: endOfYear
            }
          },
          // Контракты, которые были активны в указанном году
          {
            moveInDate: { $lt: endOfYear },
            $or: [
              { moveOutDate: { $gte: startOfYear } },
              { moveOutDate: null } // Контракты без даты окончания (текущие)
            ]
          }
        ]
      };
    }

    const contracts = await Contract.find(contractQuery)
      .skip((page - 1) * limit)
      .limit(limit)
      .sort({ createdAt: -1 });

    // ===== Вспомогательные функции =====
    function daysInMonth(year, month) {
      return new Date(year, month + 1, 0).getDate();
    }

    function calculateAccrual(moveInDate, moveOutDate, monthlyAmount, filterYear = null) {
      if (!moveInDate) return 0;

      const today = new Date();
      let start = new Date(moveInDate);
      let end = moveOutDate ? new Date(moveOutDate) : today;

      // Если указан год для фильтрации, ограничиваем расчет этим годом
      if (filterYear) {
        const yearStart = new Date(filterYear, 0, 1);
        const yearEnd = new Date(filterYear + 1, 0, 1);
        
        // Если контракт начался позже конца года или закончился до начала года
        if (start >= yearEnd || end < yearStart) return 0;
        
        // Ограничиваем период расчета указанным годом
        start = start < yearStart ? yearStart : start;
        end = end > yearEnd ? new Date(yearEnd.getTime() - 1) : end; // -1 мс, чтобы не включать первый день следующего года
      }

      if (end < start) return 0;

      if (start.getFullYear() === end.getFullYear() && start.getMonth() === end.getMonth()) {
        return ((end.getDate() - start.getDate() + 1) / daysInMonth(start.getFullYear(), start.getMonth())) * monthlyAmount;
      }

      const fullMonths = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth()) - 1;

      const firstMonthDays = daysInMonth(start.getFullYear(), start.getMonth());
      const firstMonthAccrual = ((firstMonthDays - start.getDate() + 1) / firstMonthDays) * monthlyAmount;

      const lastMonthDays = daysInMonth(end.getFullYear(), end.getMonth());
      const lastMonthAccrual = (end.getDate() / lastMonthDays) * monthlyAmount;

      return firstMonthAccrual + (fullMonths > 0 ? fullMonths * monthlyAmount : 0) + lastMonthAccrual;
    }

    // ===== Получаем самый старый год в базе =====
    const oldestContract = await Contract.findOne(
      { moveInDate: { $exists: true, $ne: null } },
      { moveInDate: 1 }
    ).sort({ moveInDate: 1 });

    const oldestAccrual = await Accrual.findOne(
      { year: { $exists: true, $ne: null } },
      { year: 1 }
    ).sort({ year: 1 });

    // Определяем самый старый год из контрактов и начислений
    let oldestYear = null;
    if (oldestContract && oldestContract.moveInDate) {
      oldestYear = new Date(oldestContract.moveInDate).getFullYear();
    }
    if (oldestAccrual && oldestAccrual.year) {
      const accrualYear = oldestAccrual.year;
      oldestYear = oldestYear ? Math.min(oldestYear, accrualYear) : accrualYear;
    }

    // Создаем список годов от самого старого до текущего
    const availableYears = [];
    if (oldestYear) {
      const currentYear = new Date().getFullYear();
      for (let year = oldestYear; year <= currentYear; year++) {
        availableYears.push(year);
      }
    }

    // ===== Обрабатываем каждый контракт =====
    const result = [];
    for (const contract of contracts) {
      // Базовый запрос для начислений
      let accrualQuery = { contractId: contract._id };
      
      // Если указан год, фильтруем начисления по году
      if (year) {
        accrualQuery.year = year;
      }

      // все начисления (для расчётов)
      const allAccruals = await Accrual.find(accrualQuery)
        .sort({ year: 1, month: 1, createdAt: 1 });

      // только часть начислений (для списка)
      const accruals = await Accrual.find(accrualQuery)
        .limit(10) // например, 10 последних начислений
        .sort({ createdAt: -1 });

      const totalPayments = allAccruals.reduce((sum, acc) => sum + (acc.accrualAmount || 0), 0);

      // Рассчитываем начисления с учетом года (если указан)
      const totalAccruals = calculateAccrual(
        contract.moveInDate,
        contract.moveOutDate,
        contract.contractAmountMinus12 || 0,
        year // Передаем год для фильтрации расчета
      );

      const debt = totalAccruals - totalPayments;

      result.push({
        contract,
        accruals,
        totalAccruals,
        totalPayments,
        debt
      });
    }

    // Получаем общее количество контрактов для пагинации
    const totalContracts = await Contract.countDocuments(contractQuery);

    res.status(200).json({
      success: true,
      data: result,
      pagination: { 
        page, 
        limit, 
        total: totalContracts,
        totalPages: Math.ceil(totalContracts / limit)
      },
      filters: {
        year: year || null,
        availableYears: availableYears
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch contracts",
      error: error.message,
    });
  }
};

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

// GET /contracts/:id — получить один контракт с начислениями и расчетами
const getOneContract = async (req, res) => {
  try {
    const { id } = req.params;
    const { year } = req.query; // опционально фильтруем по году

    // Находим контракт по id
    const contract = await Contract.findById(id);
    if (!contract) {
      return res.status(404).json({ success: false, message: "Contract not found" });
    }

    // Используем общую логику обработки
    const detailedContract = await processContract(contract, year ? parseInt(year) : null);

    res.status(200).json({
      success: true,
      data: detailedContract
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch contract",
      error: error.message
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

// ===== Вспомогательные функции =====
function daysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

function calculateAccrual(moveInDate, moveOutDate, monthlyAmount, filterYear = null) {
  if (!moveInDate) return 0;

  const today = new Date();
  let start = new Date(moveInDate);
  let end = moveOutDate ? new Date(moveOutDate) : today;

  if (filterYear) {
    const yearStart = new Date(filterYear, 0, 1);
    const yearEnd = new Date(filterYear + 1, 0, 1);

    if (start >= yearEnd || end < yearStart) return 0;

    start = start < yearStart ? yearStart : start;
    end = end > yearEnd ? new Date(yearEnd.getTime() - 1) : end;
  }

  if (end < start) return 0;

  if (start.getFullYear() === end.getFullYear() && start.getMonth() === end.getMonth()) {
    return ((end.getDate() - start.getDate() + 1) / daysInMonth(start.getFullYear(), start.getMonth())) * monthlyAmount;
  }

  const fullMonths = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth()) - 1;

  const firstMonthDays = daysInMonth(start.getFullYear(), start.getMonth());
  const firstMonthAccrual = ((firstMonthDays - start.getDate() + 1) / firstMonthDays) * monthlyAmount;

  const lastMonthDays = daysInMonth(end.getFullYear(), end.getMonth());
  const lastMonthAccrual = (end.getDate() / lastMonthDays) * monthlyAmount;

  return firstMonthAccrual + (fullMonths > 0 ? fullMonths * monthlyAmount : 0) + lastMonthAccrual;
}

async function processContract(contract, year = null) {
  let accrualQuery = { contractId: contract._id };
  if (year) accrualQuery.year = year;

  const allAccruals = await Accrual.find(accrualQuery).sort({ year: 1, month: 1, createdAt: 1 });
  const accruals = await Accrual.find(accrualQuery).limit(10).sort({ createdAt: -1 });

  const totalPayments = allAccruals.reduce((sum, acc) => sum + (acc.accrualAmount || 0), 0);
  const totalAccruals = calculateAccrual(
    contract.moveInDate,
    contract.moveOutDate,
    contract.contractAmountMinus12 || 0,
    year
  );

  const debt = totalAccruals - totalPayments;

  return {
    contract,
    accruals,
    totalAccruals,
    totalPayments,
    debt
  };
}

// ===== Новый searchContracts =====
const searchContracts = async (req, res) => {
  try {
    const { query, year } = req.query;

    if (!query || query.trim() === "") {
      return res.status(400).json({ success: false, message: "Search query is required" });
    }

    const searchRegex = new RegExp(query, "i");

    // const contracts = await Contract.find({ company: searchRegex }).sort({ createdAt: -1 });
    const contracts = await Contract.find({
      company: searchRegex,
      isArchive: false
    }).sort({ createdAt: -1 });

    // Обработка каждого контракта через общую функцию
    const result = [];
    for (const contract of contracts) {
      result.push(await processContract(contract, year ? parseInt(year) : null));
    }

    res.status(200).json({
      success: true,
      data: result,
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

const searchArchContracts = async (req, res) => {
  try {
    const { query, year } = req.query;

    if (!query || query.trim() === "") {
      return res.status(400).json({ success: false, message: "Search query is required" });
    }

    const searchRegex = new RegExp(query, "i");

    // const contracts = await Contract.find({ company: searchRegex }).sort({ createdAt: -1 });
    const contracts = await Contract.find({
      company: searchRegex,
      isArchive: true
    }).sort({ createdAt: -1 });

    // Обработка каждого контракта через общую функцию
    const result = [];
    for (const contract of contracts) {
      result.push(await processContract(contract, year ? parseInt(year) : null));
    }

    res.status(200).json({
      success: true,
      data: result,
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


const toggleArchive = async (req, res) => {
  try {
    const { id } = req.params;

    // Находим контракт
    const contract = await Contract.findById(id);
    if (!contract) {
      return res.status(404).json({ message: "Контракт не найден" });
    }

    // Проверка: moveOutDate должен быть заполнен, чтобы архивировать
    if (!contract.moveOutDate) {
      return res.status(400).json({ message: "Нельзя архивировать без даты выезда" });
    }

    // Переключаем isArchive (false -> true, true -> false)
    contract.isArchive = !contract.isArchive;
    await contract.save();

    res.json({ message: "Статус архива изменён", contract });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Маппинг числовых месяцев на строковые названия
const monthNameMap = {
  1: "Январь",
  2: "Февраль",
  3: "Март",
  4: "Апрель",
  5: "Май",
  6: "Июнь",
  7: "Июль",
  8: "Август",
  9: "Сентябрь",
  10: "Октябрь",
  11: "Ноябрь",
  12: "Декабрь"
};

// Обновленная функция calculateAccrual для поддержки строковых месяцев
function calculateAccrual(moveInDate, moveOutDate, monthlyAmount, filterYear = null, filterMonth = null) {
  if (!moveInDate) return 0;

  const today = new Date();
  let start = new Date(moveInDate);
  let end = moveOutDate ? new Date(moveOutDate) : today;

  if (filterYear) {
    // Если filterMonth передан как число, преобразуем в строковое название
    const monthName = typeof filterMonth === 'number' ? monthNameMap[filterMonth] : filterMonth;
    let periodStart = new Date(filterYear, 0, 1);
    let periodEnd = new Date(filterYear + 1, 0, 1);

    if (monthName) {
      const monthIndex = Object.values(monthNameMap).indexOf(monthName);
      if (monthIndex === -1) return 0; // Неверное название месяца
      periodStart = new Date(filterYear, monthIndex, 1);
      periodEnd = new Date(filterYear, monthIndex + 1, 1);
    }

    if (start >= periodEnd || end < periodStart) return 0;

    start = start < periodStart ? periodStart : start;
    end = end > periodEnd ? new Date(periodEnd.getTime() - 1) : end;
  }

  if (end < start) return 0;

  if (start.getFullYear() === end.getFullYear() && start.getMonth() === end.getMonth()) {
    return ((end.getDate() - start.getDate() + 1) / daysInMonth(start.getFullYear(), start.getMonth())) * monthlyAmount;
  }

  const fullMonths = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth()) - 1;

  const firstMonthDays = daysInMonth(start.getFullYear(), start.getMonth());
  const firstMonthAccrual = ((firstMonthDays - start.getDate() + 1) / firstMonthDays) * monthlyAmount;

  const lastMonthDays = daysInMonth(end.getFullYear(), end.getMonth());
  const lastMonthAccrual = (end.getDate() / lastMonthDays) * monthlyAmount;

  return firstMonthAccrual + (fullMonths > 0 ? fullMonths * monthlyAmount : 0) + lastMonthAccrual;
}

const getOldestMonth = async (req, res) => {
  try {
    // Находим самый старый контракт по moveInDate
    const oldestContract = await Contract.findOne(
      { moveInDate: { $exists: true, $ne: null } },
      { moveInDate: 1 }
    ).sort({ moveInDate: 1 });

    // Находим самое старое начисление по году и месяцу
    const oldestAccrual = await Accrual.findOne(
      { year: { $exists: true, $ne: null }, month: { $exists: true, $ne: null } },
      { year: 1, month: 1 }
    ).sort({ year: 1 }); // Сортируем только по году, так как месяц строка

    let oldestYear = null;
    let oldestMonth = null;

    // Определяем самый старый год и месяц из контрактов
    if (oldestContract && oldestContract.moveInDate) {
      const contractDate = new Date(oldestContract.moveInDate);
      oldestYear = contractDate.getFullYear();
      oldestMonth = contractDate.getMonth() + 1; // Месяц в JS начинается с 0, добавляем 1
    }

    // Сравниваем с начислениями, если они есть
    if (oldestAccrual && oldestAccrual.year && oldestAccrual.month) {
      const accrualYear = oldestAccrual.year;
      const monthIndex = Object.values(monthNameMap).indexOf(oldestAccrual.month) + 1;

      // Проверяем, является ли начисление более старым
      if (
        !oldestYear ||
        accrualYear < oldestYear ||
        (accrualYear === oldestYear && monthIndex < oldestMonth)
      ) {
        oldestYear = accrualYear;
        oldestMonth = monthIndex;
      }
    }

    if (!oldestYear || !oldestMonth) {
      return res.status(404).json({
        success: false,
        message: "No contracts or accruals found",
      });
    }

    res.status(200).json({
      success: true,
      data: {
        year: oldestYear,
        month: oldestMonth,
        monthName: monthNameMap[oldestMonth],
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch oldest month",
      error: error.message,
    });
  }
};

// Новый endpoint для статистики
const getStatistics = async (req, res) => {
  try {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1; // JS month 0-11
    const prevMonth = currentMonth === 1 ? 12 : currentMonth - 1;
    const prevMonthYear = currentMonth === 1 ? currentYear - 1 : currentYear;

    // --- Функция безопасного парсинга площади ---
    const parseArea = (val) => {
      if (val == null) return 0;
      if (typeof val === "number" && !isNaN(val)) return val;
      if (typeof val === "string") {
        const cleaned = val.trim().replace(",", ".").replace(/[^\d.]/g, "");
        const n = parseFloat(cleaned);
        return isNaN(n) ? 0 : n;
      }
      const n = Number(val);
      return isNaN(n) ? 0 : n;
    };

    // --- 1) Занятость здания ---
    const activeContracts = await Contract.find({
      isArchive: { $ne: true },
      $or: [
        { moveOutDate: null },
        { moveOutDate: { $gte: now } },
      ],
    }).select("_id company area moveOutDate isArchive");

    let occupiedArea = 0;
    for (const c of activeContracts) {
      occupiedArea += parseArea(c.area);
    }

    const totalArea = 1000; // TODO: вынести в настройки
    occupiedArea = Number(occupiedArea.toFixed(2));
    const occupancyPercentage = Number(((occupiedArea / totalArea) * 100).toFixed(2));

    // --- 2) Общий долг арендаторов ---
    const allContracts = await Contract.find().select(
      "_id moveInDate moveOutDate contractAmountMinus12"
    );

    let totalDebt = 0;
    for (const contract of allContracts) {
      const accrualsToDate = await Accrual.find({
        contractId: contract._id,
        $or: [
          { year: { $lt: currentYear } },
          { year: currentYear, month: { $lte: currentMonth } },
        ],
      });

      const paidToDate = accrualsToDate.reduce(
        (s, a) => s + (parseFloat(a.accrualAmount) || 0),
        0
      );

      const expectedToNow = calculateAccrual(
        contract.moveInDate,
        contract.moveOutDate,
        contract.contractAmountMinus12 || 0,
        null,
        null
      );

      totalDebt += expectedToNow - paidToDate;
    }
    totalDebt = Number(totalDebt.toFixed(2));

    // --- 3) Платежи за прошлый месяц ---
    const accrualsPrevMonth = await Accrual.find({
      year: prevMonthYear,
      month: monthNameMap[prevMonth],
    });
    const paymentsPrevMonth = accrualsPrevMonth.reduce(
      (s, a) => s + (parseFloat(a.accrualAmount) || 0),
      0
    );

    // --- 4) Платежи за текущий год ---
    const accrualsThisYear = await Accrual.find({ year: currentYear });
    const paymentsThisYear = accrualsThisYear.reduce(
      (s, a) => s + (parseFloat(a.accrualAmount) || 0),
      0
    );

    return res.status(200).json({
      success: true,
      data: {
        totalDebt,
        payments: {
          prevMonth: Number(paymentsPrevMonth.toFixed(2)),
          thisYear: Number(paymentsThisYear.toFixed(2)),
        },
        occupancy: {
          occupiedArea,
          totalBuildingArea: totalArea,
          occupancyPercentage,
        },
      },
    });
  } catch (error) {
    console.error("getStatistics error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch statistics",
      error: error.message,
    });
  }
};



module.exports = {
  getAllContractsNotArch,
  getAllContractsArch,
  addContract,
  getOneContract,
  updateContract,
  deleteContract,
  searchContracts,
  searchArchContracts,
  toggleArchive,
  getStatistics,
  getOldestMonth
};