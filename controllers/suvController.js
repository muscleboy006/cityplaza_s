const Contracts = require("../models/Contracts");
const Suv = require("../models/Suv");

// ✅ Создать новую запись
const createSuv = async (req, res) => {
  try {
    const { year, month, totalSuv } = req.body;

    const existing = await Suv.findOne({ year, month });
    if (existing) {
      return res.status(400).json({ message: "Запись с таким годом и месяцем уже существует" });
    }

    const newSuv = await Suv.create({ year, month, totalSuv });

    res.status(201).json({
      message: "Запись успешно создана",
      data: newSuv,
    });
  } catch (error) {
    res.status(500).json({ message: "Ошибка при создании записи", error: error.message });
  }
};

// ✅ Получить одну запись
const getOneSuv = async (req, res) => {
  try {
    const { id } = req.params;

    const suv = await Suv.findById(id);
    if (!suv) {
      return res.status(404).json({ message: "Запись не найдена" });
    }

    res.status(200).json({
      message: "Запись найдена",
      data: suv,
    });
  } catch (error) {
    res.status(500).json({ message: "Ошибка при получении записи", error: error.message });
  }
};


const getAllContracts = async (req, res) => {
  try {
    const contracts = await Contracts.find({}, "_id company"); // только нужные поля
    res.status(200).json(contracts);
  } catch (error) {
    res.status(500).json({ message: "Ошибка при получении контрактов" });
  }
};

// ✅ Добавить оплату с несколькими изображениями
const addPayment = async (req, res) => {
  try {
    const { id } = req.params;
    const { contractId, amount } = req.body;

    let images = [];
    if (req.files && req.files.length > 0) {
      images = req.files.map((file) => `/uploads/${file.filename}`);
    }

    if (!contractId || !amount) {
      return res.status(400).json({ message: "contractId и amount обязательны" });
    }

    const contract = await Contracts.findById(contractId);
    if (!contract) {
      return res.status(404).json({ message: "Договор не найден" });
    }


    const updatedDoc = await Suv.findByIdAndUpdate(
      id,
      {
        $push: {
          paymentAmount: {
            contractId,
            name: contract.company,
            amount,
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

    // Находим документ Suv
    const doc = await Suv.findById(id);
    if (!doc) {
      return res.status(404).json({ message: "Документ не найден" });
    }

    // Ищем нужный платеж внутри массива
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

// ✅ Редактировать оплату - ИСПРАВЛЕННАЯ ВЕРСИЯ
const editPayment = async (req, res) => {
  try {
    const { id, paymentId } = req.params;
    const { contractId, amount, name, existingImages, removedImages } = req.body;

    // Обработка новых загруженных изображений
    let newImages = [];
    if (req.files && req.files.length > 0) {
      newImages = req.files.map((file) => `/uploads/${file.filename}`);
      console.log("Новые изображения:", newImages);
    }

    // Находим документ Suv
    const doc = await Suv.findById(id);
    if (!doc) {
      return res.status(404).json({ message: "Документ не найден" });
    }

    // Ищем нужный платеж внутри массива
    const payment = doc.paymentAmount.id(paymentId);
    if (!payment) {
      return res.status(404).json({ message: "Платеж не найден" });
    }

    // ✅ Обновляем contractId и name
    if (contractId) {
      payment.contractId = contractId;

      // Получаем название компании из модели Contract
      const contract = await Contracts.findById(contractId);
      if (!contract) {
        return res.status(404).json({ message: "Договор не найден" });
      }
      payment.name = contract.company;
    } else if (name) {
      // Если нет contractId, но есть name (для ручного ввода)
      payment.name = name;
      payment.contractId = null;
    }

    // ✅ Обновляем amount
    if (amount) payment.amount = amount;

    // ✅ ИСПРАВЛЕННАЯ ОБРАБОТКА ИЗОБРАЖЕНИЙ
    let finalImages = [];

    // 1. Добавляем существующие изображения, которые нужно оставить
    if (existingImages) {
      try {
        const existingImagesArray = JSON.parse(existingImages);
        console.log("Существующие изображения для сохранения:", existingImagesArray);
        
        // Нормализуем пути (убираем базовый URL если есть)
        const normalizedExisting = existingImagesArray.map(img => {
          if (img.startsWith('http')) {
            // Извлекаем путь из полного URL
            return img.substring(img.indexOf('/uploads/'));
          }
          return img.startsWith('/') ? img : `/${img}`;
        });
        
        finalImages.push(...normalizedExisting);
      } catch (error) {
        console.error("Ошибка парсинга existingImages:", error);
      }
    }

    // 2. Добавляем новые изображения
    if (newImages.length > 0) {
      finalImages.push(...newImages);
    }

    // 3. Удаляем дубликаты
    finalImages = [...new Set(finalImages)];

    console.log("Финальный список изображений:", finalImages);

    // ✅ Обновляем массив изображений платежа
    payment.images = finalImages;

    // 4. Опционально: удаляем физические файлы, которые больше не нужны
    if (removedImages) {
      try {
        const removedImagesArray = JSON.parse(removedImages);
        console.log("Изображения для физического удаления:", removedImagesArray);
        
        // Здесь можно добавить логику удаления файлов с диска
        // const fs = require('fs');
        // const path = require('path');
        // 
        // removedImagesArray.forEach(imgPath => {
        //   const fullPath = path.join(__dirname, '..', 'public', imgPath);
        //   if (fs.existsSync(fullPath)) {
        //     fs.unlinkSync(fullPath);
        //     console.log("Удален файл:", fullPath);
        //   }
        // });
        
      } catch (error) {
        console.error("Ошибка обработки removedImages:", error);
      }
    }

    await doc.save();

    // console.log("Платеж успешно обновлен:", {
    //   paymentId: payment._id,
    //   amount: payment.amount,
    //   name: payment.name,
    //   contractId: payment.contractId,
    //   imagesCount: payment.images.length
    // });

    res.json({
      message: "Платеж успешно обновлен",
      data: payment, // Возвращаем только обновленный платеж
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

    const doc = await Suv.findById(id);
    if (!doc) {
      return res.status(404).json({ message: "Документ не найден" });
    }

    const paymentExists = doc.paymentAmount.id(paymentId);
    if (!paymentExists) {
      return res.status(404).json({ message: "Платеж не найден" });
    }

    await Suv.findByIdAndUpdate(id, { $pull: { paymentAmount: { _id: paymentId } } });

    res.json({ message: "Платеж успешно удален" });
  } catch (error) {
    console.error("Ошибка при удалении платежа:", error);
    res.status(500).json({ message: "Внутренняя ошибка сервера" });
  }
};

// ✅ Получить все записи с расчетами
const getAllSuv = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // ✅ Маппинг месяцев для правильной сортировки
    const monthOrder = {
      "Январь": 1,
      "Февраль": 2,
      "Март": 3,
      "Апрель": 4,
      "Май": 5,
      "Июнь": 6,
      "Июль": 7,
      "Август": 8,
      "Сентябрь": 9,
      "Октябрь": 10,
      "Ноябрь": 11,
      "Декабрь": 12,
    };

    // ✅ Получаем все записи без сортировки
    const records = await Suv.find();

    // ✅ Сортировка по году (убывание) и месяцу (убывание)
    const sortedRecords = records.sort((a, b) => {
      if (b.year !== a.year) return b.year - a.year;
      return monthOrder[b.month] - monthOrder[a.month];
    });

    // ✅ Пагинация вручную
    const paginatedRecords = sortedRecords.slice(skip, skip + parseInt(limit));

    // ✅ Считаем totalAmount, differ, inPercent
    const updatedRecords = paginatedRecords.map((record) => {
      const totalPayments = (record.paymentAmount || []).reduce((sum, p) => sum + (p.amount || 0), 0);
      const totalAmount = totalPayments;
      const totalSuv = record.totalSuv || 0;
      const differ = totalAmount - totalSuv;

      // const inPercent = totalSuv > 0 ? ((totalAmount / totalSuv) * 100).toFixed(2) : 0;
      const inPercent = totalSuv > 0 
      ? (((totalSuv - totalAmount) / totalSuv) * 100).toFixed(2) 
      : 0;

      return {
        ...record.toObject(),
        totalAmount,
        totalSuv,
        differ,
        inPercent: Number(inPercent),
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


// ✅ Обновить запись Suv
const updateSuv = async (req, res) => {
  try {
    const { id } = req.params;
    const { year, month, totalSuv } = req.body;

    const updated = await Suv.findByIdAndUpdate(
      id,
      { year, month, totalSuv },
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

// ✅ Удалить запись Suv
const deleteSuv = async (req, res) => {
  try {
    const { id } = req.params;

    const deleted = await Suv.findByIdAndDelete(id);

    if (!deleted) {
      return res.status(404).json({ message: "Запись не найдена" });
    }

    res.status(200).json({ message: "Запись успешно удалена" });
  } catch (error) {
    res.status(500).json({ message: "Ошибка при удалении", error: error.message });
  }
};

module.exports = {
  createSuv,
  getOneSuv,
  getAllSuv,
  updateSuv,
  getAllContracts,
  getOnePayment,
  addPayment,
  editPayment,
  deletePayment,
  deleteSuv,
};
