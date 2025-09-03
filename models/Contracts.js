// models/OfficeContract.js
const mongoose = require('mongoose');

const officeContractSchema = new mongoose.Schema({
  floor: { type: Number, required: true }, // Этаж
  area: { type: Number, required: true }, // Квадратура 
  officeNumber: { type: String, required: true }, // Кабинет
  company: { type: String, required: true }, // Компания
  link: { type: String }, // ССылка
  moveInDate: { type: Date, required: true }, // Дата въезда
  moveOutDate: { type: Date }, // Дата выезда
  isArchive: { type: Boolean, default: false },
  contractAmount: { type: Number, required: true }, // Сумма по договору
  contractAmountMinus12: { type: Number, required: true }, // Сумма (-12%)
}, {
  timestamps: true // createdAt, updatedAt
});

module.exports = mongoose.model('OfficeContract', officeContractSchema);