const Accrual = require("../models/Accrual");

// GET /accruals — получить список начислений с пагинацией
const getAllAccruals = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const page = parseInt(req.query.page) || 1;

    const accruals = await Accrual.find()
      .populate("contractId")
      .skip((page - 1) * limit)
      .limit(limit)
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: accruals,
      pagination: { page, limit },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch accruals",
      error: error.message,
    });
  }
};

// GET /accruals/:id — получить одно начисление по ID
const getOneAccrual = async (req, res) => {
  try {
    const accrual = await Accrual.findById(req.params.id);
    if (!accrual) {
      return res.status(404).json({ success: false, message: "Accrual not found" });
    }
    res.status(200).json({ success: true, data: accrual });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch accrual",
      error: error.message,
    });
  }
};

// GET /accruals/check/:contractId — проверить доступную сумму для начисления
const checkAvailableAmount = async (req, res) => {
  try {
    const { contractId } = req.params;
    const { year, month } = req.query;

    if (!year || !month) {
      return res.status(400).json({
        success: false,
        message: "Year and month are required"
      });
    }

    // Получаем информацию о договоре
    const Contract = require("../models/Contract"); // Предполагаем, что у вас есть модель Contract
    const contract = await Contract.findById(contractId);
    if (!contract) {
      return res.status(404).json({
        success: false,
        message: "Contract not found"
      });
    }

    // Находим все начисления за указанный год и месяц для данного договора
    const existingAccruals = await Accrual.find({
      contractId,
      year: parseInt(year),
      month
    });

    // Вычисляем общую сумму уже начисленного
    const totalAccruedAmount = existingAccruals.reduce((sum, accrual) => {
      return sum + (accrual.accrualAmount || 0);
    }, 0);

    // Вычисляем доступную сумму
    const availableAmount = contract.contractAmount - totalAccruedAmount;

    res.status(200).json({
      success: true,
      data: {
        contractAmount: contract.contractAmount,
        totalAccruedAmount,
        availableAmount: Math.max(0, availableAmount),
        existingAccruals: existingAccruals.length
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to check available amount",
      error: error.message,
    });
  }
};

// POST /accruals — создать начисление с проверкой
const createAccrual = async (req, res) => {
  try {
    const { contractId, year, month, accrualAmount } = req.body;

    // Валидация входных данных
    if (!contractId) {
      return res.status(400).json({
        success: false,
        message: "contractId обязателен"
      });
    }

    if (!year || !month) {
      return res.status(400).json({
        success: false,
        message: "Год и месяц обязательны"
      });
    }

    if (!accrualAmount || accrualAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Сумма начисления должна быть больше 0"
      });
    }

    console.log("Получены данные для создания начисления:", req.body);

    // Получаем информацию о договоре
    const Contract = require("../models/Contracts");
    const contract = await Contract.findById(contractId);
    if (!contract) {
      return res.status(404).json({
        success: false,
        message: "Договор не найден"
      });
    }

    console.log("Найден договор:", contract);

    // Находим все существующие начисления за указанный год и месяц
    const existingAccruals = await Accrual.find({
      contractId,
      year: parseInt(year),
      month
    });

    console.log("Существующие начисления:", existingAccruals);

    // Вычисляем общую сумму уже начисленного
    const totalAccruedAmount = existingAccruals.reduce((sum, accrual) => {
      return sum + (accrual.accrualAmount || 0);
    }, 0);

    // Вычисляем доступную сумму
    const availableAmount = contract.contractAmount - totalAccruedAmount;

    console.log("Расчеты:", {
      contractAmount: contract.contractAmount,
      totalAccruedAmount,
      availableAmount,
      requestedAmount: accrualAmount
    });

    // Проверяем, не превышает ли новое начисление доступную сумму
    if (accrualAmount > availableAmount) {
      return res.status(400).json({
        success: false,
        message: `Начисление не может превышать доступную сумму. Доступно: ${availableAmount.toLocaleString('ru-RU')}`,
        data: {
          contractAmount: contract.contractAmount,
          totalAccruedAmount,
          availableAmount,
          requestedAmount: accrualAmount
        }
      });
    }

    // Создаем начисление, если проверка прошла успешно
    const accrual = await Accrual.create(req.body);
    console.log("Создано начисление:", accrual);
    
    res.status(201).json({ success: true, data: accrual });

  } catch (error) {
    console.error("Ошибка при создании начисления:", error);
    res.status(400).json({
      success: false,
      message: "Failed to create accrual",
      error: error.message,
      details: error.stack // для отладки
    });
  }
};

// PUT /accruals/:id — обновить начисление с проверкой
const updateAccrual = async (req, res) => {
  try {
    const { year, month, accrualAmount, contractId } = req.body;

    // Проверка обязательных данных
    if (!contractId) {
      return res.status(400).json({
        success: false,
        message: "contractId обязателен"
      });
    }

    if (!year || !month) {
      return res.status(400).json({
        success: false,
        message: "Год и месяц обязательны"
      });
    }

    if (!accrualAmount || accrualAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Сумма начисления должна быть больше 0"
      });
    }

    // Проверяем, существует ли договор
    const Contract = require("../models/Contracts");
    const contract = await Contract.findById(contractId);
    if (!contract) {
      return res.status(404).json({
        success: false,
        message: "Договор не найден"
      });
    }

    // Находим все начисления за этот год и месяц, кроме текущего редактируемого
    const existingAccruals = await Accrual.find({
      contractId,
      year: parseInt(year),
      month,
      _id: { $ne: req.params.id }
    });

    // Считаем сумму уже начисленного (без текущего)
    const totalAccruedAmount = existingAccruals.reduce((sum, accrual) => {
      return sum + (accrual.accrualAmount || 0);
    }, 0);

    // Вычисляем доступную сумму
    const availableAmount = contract.contractAmount - totalAccruedAmount;

    // Проверяем, не превышает ли новое значение доступную сумму
    if (accrualAmount > availableAmount) {
      return res.status(400).json({
        success: false,
        message: `Начисление не может превышать доступную сумму. Доступно: ${availableAmount.toLocaleString('ru-RU')}`,
        data: {
          contractAmount: contract.contractAmount,
          totalAccruedAmount,
          availableAmount,
          requestedAmount: accrualAmount
        }
      });
    }

    // Обновляем начисление
    const accrual = await Accrual.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    if (!accrual) {
      return res.status(404).json({
        success: false,
        message: "Accrual not found"
      });
    }

    res.status(200).json({ success: true, data: accrual });
  } catch (error) {
    console.error("Ошибка при обновлении начисления:", error);
    res.status(400).json({
      success: false,
      message: "Failed to update accrual",
      error: error.message,
      details: error.stack
    });
  }
};

// DELETE /accruals/:id — удалить начисление
const deleteAccrual = async (req, res) => {
  try {
    const deletedAccrual = await Accrual.findByIdAndDelete(req.params.id);
    if (!deletedAccrual) {
      return res
        .status(404)
        .json({ success: false, message: "Accrual not found" });
    }
    res.status(200).json({
      success: true,
      message: "Accrual deleted successfully",
      data: deletedAccrual,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to delete accrual",
      error: error.message,
    });
  }
};

module.exports = {
  getAllAccruals,
  getOneAccrual,
  createAccrual,
  updateAccrual,
  deleteAccrual,
  checkAvailableAmount,
};