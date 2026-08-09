import {
  FaSnowflake, FaWifi, FaBook, FaRegBuilding, FaBath, FaWater,
  FaUtensils, FaShirt, FaCar, FaBroom, FaTv, FaKitchenSet, FaBowlFood,
  FaSoap, FaRupeeSign, FaClock,
} from "react-icons/fa6";

const ICONS = {
  AC: FaSnowflake,
  WiFi: FaWifi,
  "Study Table": FaBook,
  Fridge: FaRegBuilding,
  "Attached Bathroom": FaBath,
  Geyser: FaWater,
  Meals: FaUtensils,
  Laundry: FaShirt,
  Parking: FaCar,
  Housekeeping: FaBroom,
  TV: FaTv,
  Kitchen: FaKitchenSet,
  Mess: FaBowlFood,
  "Washing Machine": FaSoap,
  "Bills Included": FaRupeeSign,
  "Time Restriction": FaClock,
};

export default function FacilityIcon({ name, size = 14, className = "" }) {
  const Icon = ICONS[name.trim()];
  if (!Icon) return null;
  return <Icon size={size} className={className} aria-hidden="true" />;
}
