-- 0001_extensions_and_enums.sql
-- Run first. Enables PostGIS and defines all enum types.

create extension if not exists postgis;
create extension if not exists "uuid-ossp";

create type user_role as enum ('donor', 'ngo', 'volunteer', 'government', 'admin');

create type org_type as enum ('restaurant', 'supermarket', 'hotel', 'bakery', 'other');

create type food_category as enum ('cooked_meal', 'bakery', 'produce', 'dairy', 'packaged', 'other');

create type storage_condition as enum ('room_temp', 'refrigerated', 'frozen', 'hot_held');

create type packaging_type as enum ('sealed', 'covered', 'open');

create type donation_status as enum (
  'listed', 'claimed', 'assigned', 'in_transit', 'delivered', 'verified', 'expired', 'cancelled'
);

create type assignment_status as enum ('offered', 'accepted', 'picked_up', 'delivered', 'cancelled');

create type vehicle_type as enum ('none', 'bike', 'motorbike', 'car', 'van');

create type emergency_status as enum ('open', 'partially_filled', 'fulfilled', 'expired');
