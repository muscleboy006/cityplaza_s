// controllers/mancomController.js
const Mancom = require("../models/Mancom");
const Accruals = require("../models/Accrual");

// ✅ Получить данные по расчету
const getAllMancom = async (req, res) => {
    try {
      const { year, page = 1, limit = 10 } = req.query;
      if (!year) {
        return res.status(400).json({ message: "Укажите год (year) в query" });
      }
  
      // ✅ 1. Общая сумма accrualAmount (без фильтра по году)
      const totalAccrual = await Accruals.aggregate([
        { $group: { _id: null, total: { $sum: "$accrualAmount" } } }
      ]);
      const totalAccrualAmount = totalAccrual.length > 0 ? totalAccrual[0].total : 0;
  
      // ✅ 2. Считаем проценты
      const companyPercentages = {
        "Компания 1": totalAccrualAmount * 0.07,
        "Компания 2": totalAccrualAmount * 0.02
      };
  
      // ✅ 3. Получаем суммы оплат за выбранный год
      const startDate = new Date(`${year}-01-01`);
      const endDate = new Date(`${year}-12-31`);
  
      const mancomAmounts = await Mancom.aggregate([
        { $match: { date: { $gte: startDate, $lte: endDate } } },
        { $group: { _id: "$mancom", totalAmount: { $sum: "$amount" } } }
      ]);
  
      // ✅ 4. Формируем расчет для каждой компании
      const companies = ["Компания 1", "Компания 2"].map(company => {
        const paid = mancomAmounts.find(item => item._id === company)?.totalAmount || 0;
        const needToPay = companyPercentages[company];
        const debt = needToPay - paid;
  
        return {
          company,
          accrualBase: totalAccrualAmount,
          needToPay,
          paid,
          debt
        };
      });
  
      // ✅ 5. Получаем список всех платежей с пагинацией
      const skip = (parseInt(page) - 1) * parseInt(limit);
  
      const [records, totalRecords] = await Promise.all([
        Mancom.find({ date: { $gte: startDate, $lte: endDate } })
          .sort({ date: -1 })
          .skip(skip)
          .limit(parseInt(limit)),
        Mancom.countDocuments({ date: { $gte: startDate, $lte: endDate } })
      ]);
  
      // ✅ Ответ
      res.json({
        year,
        totalAccrualAmount,
        companies,
        payments: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: totalRecords,
          totalPages: Math.ceil(totalRecords / limit),
          data: records
        }
      });
  
    } catch (error) {
      console.error("Ошибка:", error);
      res.status(500).json({ message: "Ошибка при расчете данных", error: error.message });
    }
  };

// ✅ Получить одну запись по ID
const getOneMancom = async (req, res) => {
  try {
    const { id } = req.params;
    const mancom = await Mancom.findById(id);

    if (!mancom) {
      return res.status(404).json({ message: "Запись не найдена" });
    }

    res.json(mancom);
  } catch (error) {
    res.status(500).json({ message: "Ошибка при получении записи", error });
  }
};

// ✅ Добавить новую запись
const addMancom = async (req, res) => {
  try {
    const { date, mancom, amount } = req.body;

    if (!date || !mancom) {
      return res.status(400).json({ message: "Дата и управляющая компания обязательны" });
    }

    const newMancom = await Mancom.create({ date, mancom, amount });
    res.status(201).json(newMancom);
  } catch (error) {
    res.status(500).json({ message: "Ошибка при добавлении", error });
  }
};

// ✅ Редактировать запись
const editMancom = async (req, res) => {
  try {
    const { id } = req.params;
    const { date, mancom, amount } = req.body;

    const updatedMancom = await Mancom.findByIdAndUpdate(
      id,
      { date, mancom, amount },
      { new: true, runValidators: true }
    );

    if (!updatedMancom) {
      return res.status(404).json({ message: "Запись не найдена" });
    }

    res.json(updatedMancom);
  } catch (error) {
    res.status(500).json({ message: "Ошибка при редактировании", error });
  }
};

// ✅ Удалить запись
const delMancom = async (req, res) => {
  try {
    const { id } = req.params;
    const deletedMancom = await Mancom.findByIdAndDelete(id);

    if (!deletedMancom) {
      return res.status(404).json({ message: "Запись не найдена" });
    }

    res.json({ message: "Запись удалена" });
  } catch (error) {
    res.status(500).json({ message: "Ошибка при удалении", error });
  }
};

// ✅ Получить только задолженность по компаниям (без фильтра по году)
const getDebtMancom = async (req, res) => {
  try {
    const round = (num) => Math.round(num * 100) / 100; // округление до 2 знаков

    // ✅ 1. Общая сумма accrualAmount
    const totalAccrual = await Accruals.aggregate([
      { $group: { _id: null, total: { $sum: "$accrualAmount" } } }
    ]);
    const totalAccrualAmount = totalAccrual.length > 0 ? totalAccrual[0].total : 0;

    // ✅ 2. Считаем проценты
    const companyPercentages = {
      "Компания 1": totalAccrualAmount * 0.07,
      "Компания 2": totalAccrualAmount * 0.02
    };

    // ✅ 3. Получаем суммы оплат за всё время
    const mancomAmounts = await Mancom.aggregate([
      { $group: { _id: "$mancom", totalAmount: { $sum: "$amount" } } }
    ]);

    // ✅ 4. Формируем расчёт по долгу
    const companies = ["Компания 1", "Компания 2"].map(company => {
      const paid = mancomAmounts.find(item => item._id === company)?.totalAmount || 0;
      const needToPay = companyPercentages[company];
      const debt = needToPay - paid;

      return {
        company,
        accrualBase: round(totalAccrualAmount),
        needToPay: round(needToPay),
        paid: round(paid),
        debt: round(debt)
      };
    });

    // ✅ 5. Общий итоговый долг
    const totalDebt = round(companies.reduce((sum, c) => sum + c.debt, 0));

    res.json({
      totalAccrualAmount: round(totalAccrualAmount),
      totalDebt,
      companies
    });

  } catch (error) {
    console.error("Ошибка:", error);
    res.status(500).json({ message: "Ошибка при расчёте задолженности", error: error.message });
  }
};


module.exports = {
  getAllMancom,
  getOneMancom,
  addMancom,
  editMancom,
  delMancom,
  getDebtMancom
};