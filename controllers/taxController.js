const Tax = require("../models/Tax");

// ✅ Создать новую запись
const createTax = async (req, res) => {
  try {
    const { year, totalTax } = req.body;

    const existing = await Tax.findOne({ year });
    if (existing) {
      return res.status(400).json({ message: "Запись с таким годом уже существует" });
    }

    const newTax = await Tax.create({ year, totalTax });

    res.status(201).json({
      message: "Запись успешно создана",
      data: newTax,
    });
  } catch (error) {
    res.status(500).json({ message: "Ошибка при создании записи", error: error.message });
  }
};

// ✅ Получить одну запись
const getOneTax = async (req, res) => {
  try {
    const { id } = req.params;

    const tax = await Tax.findById(id);
    if (!tax) {
      return res.status(404).json({ message: "Запись не найдена" });
    }

    res.status(200).json({
      message: "Запись найдена",
      data: tax,
    });
  } catch (error) {
    res.status(500).json({ message: "Ошибка при получении записи", error: error.message });
  }
};

// ✅ Добавить оплату
const addPayment = async (req, res) => {
  try {
    const { id } = req.params;
    const { amount, date } = req.body;

    let images = [];
    if (req.files && req.files.length > 0) {
      images = req.files.map((file) => `/uploads/${file.filename}`);
    }

    if (!amount || !date) {
      return res.status(400).json({ message: "amount и date обязательны" });
    }

    const updatedDoc = await Tax.findByIdAndUpdate(
      id,
      {
        $push: {
          paymentAmount: {
            amount,
            date,
            images,
          },
        },
      },
      { new: true }
    );

    if (!updatedDoc) {
      return res.status(404).json({ message: "Документ не найден" });
    }

    res.json({
      message: "Оплата успешно добавлена",
      data: updatedDoc,
    });
  } catch (error) {
    console.error("Ошибка при добавлении оплаты:", error);
    res.status(500).json({ message: "Внутренняя ошибка сервера" });
  }
};

// ✅ Получить один платеж
const getOnePayment = async (req, res) => {
  try {
    const { id, paymentId } = req.params;

    const doc = await Tax.findById(id);
    if (!doc) {
      return res.status(404).json({ message: "Документ не найден" });
    }

    const payment = doc.paymentAmount.id(paymentId);
    if (!payment) {
      return res.status(404).json({ message: "Платеж не найден" });
    }

    res.status(200).json({
      message: "Платеж найден",
      data: payment,
    });
  } catch (error) {
    console.error("Ошибка при получении платежа:", error);
    res.status(500).json({ message: "Внутренняя ошибка сервера", error: error.message });
  }
};

// ✅ Редактировать оплату
const editPayment = async (req, res) => {
  try {
    const { id, paymentId } = req.params;
    const { amount, date, existingImages, removedImages } = req.body;

    let newImages = [];
    if (req.files && req.files.length > 0) {
      newImages = req.files.map((file) => `/uploads/${file.filename}`);
    }

    const doc = await Tax.findById(id);
    if (!doc) {
      return res.status(404).json({ message: "Документ не найден" });
    }

    const payment = doc.paymentAmount.id(paymentId);
    if (!payment) {
      return res.status(404).json({ message: "Платеж не найден" });
    }

    if (amount) payment.amount = amount;
    if (date) payment.date = date;

    let finalImages = [];

    if (existingImages) {
      try {
        const existingImagesArray = JSON.parse(existingImages);
        const normalizedExisting = existingImagesArray.map(img => {
          if (img.startsWith('http')) {
            return img.substring(img.indexOf('/uploads/'));
          }
          return img.startsWith('/') ? img : `/${img}`;
        });
        finalImages.push(...normalizedExisting);
      } catch (error) {
        console.error("Ошибка парсинга existingImages:", error);
      }
    }

    if (newImages.length > 0) {
      finalImages.push(...newImages);
    }

    finalImages = [...new Set(finalImages)];

    payment.images = finalImages;

    if (removedImages) {
      try {
        const removedImagesArray = JSON.parse(removedImages);
        console.log("Изображения для удаления:", removedImagesArray);
        // Здесь можно добавить удаление файлов с диска
      } catch (error) {
        console.error("Ошибка обработки removedImages:", error);
      }
    }

    await doc.save();

    res.json({
      message: "Платеж успешно обновлен",
      data: payment,
      totalImages: payment.images.length
    });

  } catch (error) {
    console.error("Ошибка при редактировании оплаты:", error);
    res.status(500).json({
      message: "Внутренняя ошибка сервера",
      error: error.message
    });
  }
};

// ✅ Удалить один платеж
const deletePayment = async (req, res) => {
  try {
    const { id, paymentId } = req.params;

    const doc = await Tax.findById(id);
    if (!doc) {
      return res.status(404).json({ message: "Документ не найден" });
    }

    const paymentExists = doc.paymentAmount.id(paymentId);
    if (!paymentExists) {
      return res.status(404).json({ message: "Платеж не найден" });
    }

    await Tax.findByIdAndUpdate(id, { $pull: { paymentAmount: { _id: paymentId } } });

    res.json({ message: "Платеж успешно удален" });
  } catch (error) {
    console.error("Ошибка при удалении платежа:", error);
    res.status(500).json({ message: "Внутренняя ошибка сервера" });
  }
};

// ✅ Получить все записи с расчетами (только суммы)
const getAllTax = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const records = await Tax.find();

    const sortedRecords = records.sort((a, b) => b.year - a.year);

    const paginatedRecords = sortedRecords.slice(skip, skip + parseInt(limit));

    const updatedRecords = paginatedRecords.map((record) => {
      const totalPayments = (record.paymentAmount || []).reduce(
        (sum, p) => sum + (p.amount || 0),
        0
      );

      const totalTax = record.totalTax || 0;
      const debt = totalTax - totalPayments;

      return {
        ...record.toObject(),
        totalAmount: totalPayments,
        totalTax,
        debt
      };
    });

    res.status(200).json({
      message: "Список найден",
      page: parseInt(page),
      limit: parseInt(limit),
      total: records.length,
      totalPages: Math.ceil(records.length / limit),
      data: updatedRecords,
    });
  } catch (error) {
    console.error("Ошибка при получении данных:", error);
    res.status(500).json({ message: "Ошибка при получении данных", error: error.message });
  }
};

// ✅ Обновить запись Tax
const updateTax = async (req, res) => {
  try {
    const { id } = req.params;
    const { year, totalTax } = req.body;

    const updated = await Tax.findByIdAndUpdate(
      id,
      { year, totalTax },
      { new: true, runValidators: true }
    );

    if (!updated) {
      return res.status(404).json({ message: "Запись не найдена" });
    }

    res.status(200).json({
      message: "Запись успешно обновлена",
      data: updated,
    });
  } catch (error) {
    res.status(500).json({ message: "Ошибка при обновлении", error: error.message });
  }
};

// ✅ Удалить запись Tax
const deleteTax = async (req, res) => {
  try {
    const { id } = req.params;

    const deleted = await Tax.findByIdAndDelete(id);

    if (!deleted) {
      return res.status(404).json({ message: "Запись не найдена" });
    }

    res.status(200).json({ message: "Запись успешно удалена" });
  } catch (error) {
    res.status(500).json({ message: "Ошибка при удалении", error: error.message });
  }
};

// ✅ Получить общий долг
const getTotalDebt = async (req, res) => {
  try {
    // Получаем все документы
    const records = await Tax.find();

    // Суммируем totalTax
    const totalTax = records.reduce((sum, rec) => sum + (rec.totalTax || 0), 0);

    // Суммируем все оплаты
    const totalPayments = records.reduce((sum, rec) => {
      const paymentsSum = (rec.paymentAmount || []).reduce((s, p) => s + (p.amount || 0), 0);
      return sum + paymentsSum;
    }, 0);

    // Долг = totalTax - totalPayments
    const totalDebt = totalTax - totalPayments;

    res.status(200).json({
      message: "Общий долг успешно рассчитан",
      totalTax,
      totalPayments,
      totalDebt,
    });
  } catch (error) {
    console.error("Ошибка при расчёте общего долга:", error);
    res.status(500).json({ message: "Ошибка при расчёте общего долга", error: error.message });
  }
};

module.exports = {
  createTax,
  getOneTax,
  getAllTax,
  updateTax,
  addPayment,
  getOnePayment,
  editPayment,
  deletePayment,
  deleteTax,
  getTotalDebt
};