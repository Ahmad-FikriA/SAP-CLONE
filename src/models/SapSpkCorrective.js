const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const SapSpkCorrective = sequelize.define(
  "SapSpkCorrective",
  {
    order_number: {
      type: DataTypes.STRING,
      primaryKey: true,
      allowNull: false,
    },
    description: DataTypes.TEXT,
    sys_status: DataTypes.STRING,
    cost_center: DataTypes.STRING,
    ctrl_key: DataTypes.STRING,
    confirm_number: DataTypes.STRING,
    work_center: DataTypes.STRING,
    activity: DataTypes.STRING,
    short_text: DataTypes.TEXT,
    normal_dur: DataTypes.DECIMAL(10, 2),
    normal_dur_un: DataTypes.STRING,
    dur_plan: DataTypes.DECIMAL(10, 2),
    unit_for_work: DataTypes.STRING,
    dur_act: DataTypes.DECIMAL(10, 2),
    posting_date: DataTypes.DATEONLY,
    conf_text: DataTypes.TEXT,
    reason_of_var: DataTypes.TEXT,
    work_start: DataTypes.DATEONLY,
    work_finish: DataTypes.DATEONLY,
    start_time: DataTypes.TIME,
    finish_time: DataTypes.TIME,
    report_by: DataTypes.STRING,
    equipment_name: DataTypes.STRING,
    functional_location: DataTypes.STRING,
    
    // Custom Fields
    status: {
      type: DataTypes.ENUM(
        "baru_import",
        "eksekusi",
        "menunggu_review_kadis_pp",
        "menunggu_review_kadis_pelapor",
        "selesai",
        "ditolak"
      ),
      defaultValue: "baru_import",
    },
    actual_materials: DataTypes.TEXT,
    actual_tools: DataTypes.TEXT,
    actual_personnel: DataTypes.INTEGER,
    total_actual_hour: DataTypes.DECIMAL(10, 2),
    execution_nik: DataTypes.STRING,
    job_result_description: DataTypes.TEXT,
    photo_before: DataTypes.STRING,
    photo_after: DataTypes.STRING,
    
    kadis_pusat_approved_by: DataTypes.STRING,
    kadis_pusat_approved_at: DataTypes.DATE,
    kadis_pelapor_approved_by: DataTypes.STRING,
    kadis_pelapor_approved_at: DataTypes.DATE,
    rejected_by: DataTypes.STRING,
    rejected_at: DataTypes.DATE,
    rejection_note: DataTypes.TEXT,
  },
  {
    tableName: "sap_spk_corrective",
    timestamps: true,
    underscored: true,
  }
);

module.exports = SapSpkCorrective;
