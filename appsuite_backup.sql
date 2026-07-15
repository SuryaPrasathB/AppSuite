CREATE DATABASE  IF NOT EXISTS `smart_store` /*!40100 DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci */ /*!80016 DEFAULT ENCRYPTION='N' */;
USE `smart_store`;
-- MySQL dump 10.13  Distrib 8.0.42, for Win64 (x86_64)
--
-- Host: localhost    Database: smart_store
-- ------------------------------------------------------
-- Server version	8.0.42

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `bom_items`
--

DROP TABLE IF EXISTS `bom_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `bom_items` (
  `id` int NOT NULL AUTO_INCREMENT,
  `bom_id` int DEFAULT NULL,
  `product_id` int DEFAULT NULL,
  `quantity_required` decimal(10,2) NOT NULL DEFAULT '1.00',
  `quantity_issued` decimal(10,2) NOT NULL DEFAULT '0.00',
  `remarks` text,
  `manual_product_name` varchar(255) DEFAULT NULL,
  `part_number` varchar(100) DEFAULT NULL,
  `manufacturer` varchar(100) DEFAULT NULL,
  `link` varchar(500) DEFAULT NULL,
  `custom_fields` json DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `product_id` (`product_id`),
  KEY `idx_bom_items_bom` (`bom_id`),
  CONSTRAINT `bom_items_ibfk_1` FOREIGN KEY (`bom_id`) REFERENCES `boms` (`id`) ON DELETE CASCADE,
  CONSTRAINT `bom_items_ibfk_2` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=25 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `bom_items`
--

LOCK TABLES `bom_items` WRITE;
/*!40000 ALTER TABLE `bom_items` DISABLE KEYS */;
INSERT INTO `bom_items` VALUES (21,7,9,5.00,0.00,'','Contactor 3P 25A 440V','LC1D25M7','Schneider Electric','https://assets.rs-online.com/v1696934226/Datasheets/7f4f4a8b56e5c37d6f3f470796d3c248.pdf','{}'),(22,8,NULL,1.00,0.00,'','HMI','HMIET6400','Schneider','','{}'),(23,8,NULL,1.00,0.00,'','Labour','','','','{}'),(24,8,NULL,1.00,0.00,'','Service Charge','','','','{}');
/*!40000 ALTER TABLE `bom_items` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `boms`
--

DROP TABLE IF EXISTS `boms`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `boms` (
  `id` int NOT NULL AUTO_INCREMENT,
  `project_id` int DEFAULT NULL,
  `name` varchar(255) NOT NULL,
  `status` varchar(50) DEFAULT 'DRAFT',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_boms_project` (`project_id`),
  CONSTRAINT `boms_ibfk_1` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `boms`
--

LOCK TABLES `boms` WRITE;
/*!40000 ALTER TABLE `boms` DISABLE KEYS */;
INSERT INTO `boms` VALUES (7,9,'BOM 1','APPROVED','2026-07-10 11:18:27','2026-07-10 11:18:32'),(8,NULL,'Dummy','DRAFT','2026-07-14 06:09:24','2026-07-14 06:09:24');
/*!40000 ALTER TABLE `boms` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `dynamic_tasks`
--

DROP TABLE IF EXISTS `dynamic_tasks`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `dynamic_tasks` (
  `id` int NOT NULL AUTO_INCREMENT,
  `project_id` int DEFAULT NULL,
  `parent_id` int DEFAULT NULL,
  `title` varchar(255) NOT NULL,
  `description` text,
  `status` varchar(50) DEFAULT 'TODO',
  `priority` varchar(20) DEFAULT 'MEDIUM',
  `assignee_id` int DEFAULT NULL,
  `start_date` date DEFAULT NULL,
  `due_date` date DEFAULT NULL,
  `dependencies` text,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `project_id` (`project_id`),
  KEY `parent_id` (`parent_id`),
  KEY `assignee_id` (`assignee_id`),
  CONSTRAINT `dynamic_tasks_ibfk_1` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`) ON DELETE CASCADE,
  CONSTRAINT `dynamic_tasks_ibfk_2` FOREIGN KEY (`parent_id`) REFERENCES `dynamic_tasks` (`id`) ON DELETE CASCADE,
  CONSTRAINT `dynamic_tasks_ibfk_3` FOREIGN KEY (`assignee_id`) REFERENCES `employees` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=27 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `dynamic_tasks`
--

LOCK TABLES `dynamic_tasks` WRITE;
/*!40000 ALTER TABLE `dynamic_tasks` DISABLE KEYS */;
INSERT INTO `dynamic_tasks` VALUES (5,6,NULL,'BOM Preparation','','IN_PROGRESS','HIGH',8,'2026-07-08','2026-07-15',NULL,'2026-07-08 05:55:13','2026-07-10 11:05:51'),(7,6,5,'Electronics',NULL,'IN_PROGRESS','MEDIUM',8,'2026-07-08','2026-07-15',NULL,'2026-07-08 06:47:55','2026-07-13 09:58:10'),(8,6,5,'Mechanical',NULL,'IN_PROGRESS','MEDIUM',13,'2026-07-08','2026-07-15',NULL,'2026-07-08 09:55:17','2026-07-10 11:14:00'),(15,6,NULL,'Procurement',NULL,'IN_PROGRESS','MEDIUM',12,'2026-07-08','2026-07-31',NULL,'2026-07-09 10:56:12','2026-07-10 11:06:10'),(16,6,NULL,'LDU Board Flashing',NULL,'TODO','MEDIUM',10,'2026-09-01','2026-09-04',NULL,'2026-07-09 12:31:00','2026-07-10 11:06:54'),(19,9,NULL,'WIRING','','IN_PROGRESS','MEDIUM',14,'2026-07-10','2026-07-17',NULL,'2026-07-10 10:58:28','2026-07-10 11:24:46'),(20,6,NULL,'Display Flashing',NULL,'TODO','MEDIUM',2,'2026-09-01','2026-09-04',NULL,'2026-07-10 11:06:26','2026-07-10 11:06:51'),(21,6,NULL,'Scanner Board Testing',NULL,'TODO','MEDIUM',11,'2026-08-17','2026-08-28',NULL,'2026-07-10 11:06:39','2026-07-10 11:06:58'),(23,9,NULL,'TESTING','','TODO','MEDIUM',6,'2026-07-17','2026-07-21','[{\"id\":19,\"type\":\"FS\"}]','2026-07-10 11:21:01','2026-07-13 05:15:01'),(26,6,NULL,'LDU BOM',NULL,'COMPLETED','MEDIUM',10,'2026-07-08','2026-07-10',NULL,'2026-07-10 11:26:55','2026-07-10 11:27:42');
/*!40000 ALTER TABLE `dynamic_tasks` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `employees`
--

DROP TABLE IF EXISTS `employees`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `employees` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `role` varchar(100) DEFAULT NULL,
  `phone` varchar(50) DEFAULT NULL,
  `email` varchar(255) DEFAULT NULL,
  `department` varchar(100) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `username` varchar(255) DEFAULT NULL,
  `password_hash` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `username` (`username`)
) ENGINE=InnoDB AUTO_INCREMENT=17 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `employees`
--

LOCK TABLES `employees` WRITE;
/*!40000 ALTER TABLE `employees` DISABLE KEYS */;
INSERT INTO `employees` VALUES (2,'Surya','Administrator','','','R&D','2026-06-26 07:02:06','Surya','$2b$12$E62bHjPxzRUxXCczvBr6Ae2CPOUkQ4CxKRJCPuIJIs9Ffaof87V5O'),(6,'Subhash','Employee','','','Testing','2026-06-26 08:50:06','subhash','$2b$12$0ekEH9vcuN5dtcQ8E2Z0V.qlMQgzk3xbM0GUX7LGMfHg5fBOobCA6'),(7,'Store Keeper','Store Operator','','','','2026-06-26 12:01:31','Store','$2b$12$2B5ZXZvPiDUzSLB5OUURlue8V0UF4UA2QFEyfg1giPfhk6ELCX6za'),(8,'Chiranjeevi','Employee','','','Electrical','2026-07-08 09:48:47','chiranjeevi','$2b$12$GbcA8FetBBoeVlNnqEP.6etZdeIYUzxICriAYKmV3OADvh5sc9bDi'),(9,'Aruna','Employee','','','Wiring','2026-07-08 09:49:10','aruna','$2b$12$e7MmYIbVQxxsnfIqBeTi8ONnKPTuPmOIXHk97QUcB06DpVVaNY9zW'),(10,'Pradeep Rajkumar','Administrator','','','R&D','2026-07-08 09:49:30','pradeep','$2b$12$Rd5Q/FV5/4zSFGX8sco2gOE0RP2ljWpcO4mYj8QBpzKkmH79YHttK'),(11,'Aravind','Employee','','','Testing','2026-07-08 09:49:59','aravind','$2b$12$0IG0bKRfFSKmg4Qri1ruB.VcFd21edbqVb.wiicfNoRgfrWAM3b32'),(12,'Supriya','Administrator','','','Manager','2026-07-08 09:50:30','supriya','$2b$12$hk9cWAh0Y2.wcOlkhAt5he4Zbcbn9ZIbDfjor7IuTqi/9HX384GgG'),(13,'Ramesh','Employee','','','Design','2026-07-08 09:51:18','ramesh','$2b$12$HRV58xsiZdK/o.ePej1yPuDkOv0agVoFV0.SXzrf7r2lTnFPhR74e'),(14,'Panchakshari','Employee','','','Wiring','2026-07-10 11:01:32','pancha','$2b$12$05azM8GPB.idIzdz.QbHK.3iqckvzbqdF9nwd4jflaNoBj0KyGNBO'),(15,'Rajana','Employee','','','Winding','2026-07-10 11:02:06','raja','$2b$12$XkF8dBOvztMxVOupX0IrXeYfwaJqSV6t7GoIuDYF8Ga5J6m0o8mgG'),(16,'Sundermurthy','Administrator','','','M.D.','2026-07-10 11:33:09','sunder','$2b$12$xeD6dBGUQ2ratUKVaPMitezcP3O03JFPq68n2b829b6/1H7Mhsq1O');
/*!40000 ALTER TABLE `employees` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `inventory_transactions`
--

DROP TABLE IF EXISTS `inventory_transactions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `inventory_transactions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `user_name` varchar(255) NOT NULL,
  `user_role` varchar(100) NOT NULL,
  `product_id` int DEFAULT NULL,
  `quantity` decimal(10,2) NOT NULL,
  `action` varchar(50) NOT NULL,
  `from_location_id` int DEFAULT NULL,
  `to_location_id` int DEFAULT NULL,
  `remarks` text,
  PRIMARY KEY (`id`),
  KEY `product_id` (`product_id`),
  KEY `from_location_id` (`from_location_id`),
  KEY `to_location_id` (`to_location_id`),
  CONSTRAINT `inventory_transactions_ibfk_1` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE,
  CONSTRAINT `inventory_transactions_ibfk_2` FOREIGN KEY (`from_location_id`) REFERENCES `locations` (`id`) ON DELETE SET NULL,
  CONSTRAINT `inventory_transactions_ibfk_3` FOREIGN KEY (`to_location_id`) REFERENCES `locations` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `inventory_transactions`
--

LOCK TABLES `inventory_transactions` WRITE;
/*!40000 ALTER TABLE `inventory_transactions` DISABLE KEYS */;
INSERT INTO `inventory_transactions` VALUES (1,'2026-06-25 10:07:16','Surya (Admin)','Administrator',NULL,50.00,'STOCK_IN',NULL,NULL,'[{\"product_id\": 4, \"product_name\": \"Contactor 3P 25A 480V\", \"product_code\": \"CON-SCH\", \"location_id\": 1, \"location_label\": \"Zone A-Rack A1-Shelf Shelf 1-Bin Bin 1\", \"quantity\": 50.0, \"remarks\": \"Batch: 1\"}]');
/*!40000 ALTER TABLE `inventory_transactions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `locations`
--

DROP TABLE IF EXISTS `locations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `locations` (
  `id` int NOT NULL AUTO_INCREMENT,
  `zone` varchar(100) NOT NULL,
  `rack` varchar(100) NOT NULL,
  `shelf` varchar(100) NOT NULL,
  `bin` varchar(100) NOT NULL,
  `row_index` int DEFAULT '0',
  `col_index` int DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `zone` (`zone`,`rack`,`shelf`,`bin`)
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `locations`
--

LOCK TABLES `locations` WRITE;
/*!40000 ALTER TABLE `locations` DISABLE KEYS */;
INSERT INTO `locations` VALUES (1,'Zone A','A1','Shelf 1','Bin 1',0,0,'2026-06-25 07:59:47'),(2,'Zone A','A1','Shelf 2','Bin 1',0,0,'2026-06-25 11:06:24'),(3,'Zone D','C3','Shelf 5','Bin 9',0,0,'2026-06-25 11:14:39'),(4,'Zone A','A2','Shelf 1','Bin 1',0,1,'2026-06-25 11:39:27'),(5,'Zone A','A2','Shelf 2','Bin 1',0,0,'2026-06-25 11:54:02'),(6,'Zone B','A3','Shelf 1','Bin 1',0,0,'2026-06-26 11:55:50'),(7,'Zone A','A2','Shelf 1','Bin 2',0,0,'2026-07-10 09:19:16');
/*!40000 ALTER TABLE `locations` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `notifications`
--

DROP TABLE IF EXISTS `notifications`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `notifications` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `title` varchar(255) NOT NULL,
  `message` text,
  `link` varchar(500) DEFAULT NULL,
  `is_read` tinyint(1) DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `notifications_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `employees` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=20 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `notifications`
--

LOCK TABLES `notifications` WRITE;
/*!40000 ALTER TABLE `notifications` DISABLE KEYS */;
INSERT INTO `notifications` VALUES (1,10,'Task Assigned','You have been assigned the task \'LDU Board Flashing\' in 40 Pos Test Bench 03.','/projects/6',0,'2026-07-09 12:31:14'),(2,2,'New BOM Created','A new BOM \'BOM 1\' has been created and is ready for review.','/bom',1,'2026-07-10 06:05:01'),(3,10,'New BOM Created','A new BOM \'BOM 1\' has been created and is ready for review.','/bom',0,'2026-07-10 06:05:01'),(4,12,'New BOM Created','A new BOM \'BOM 1\' has been created and is ready for review.','/bom',0,'2026-07-10 06:05:01'),(5,6,'Task Assigned','You have been assigned the task \'TASK 1\' in RESISTIVE LIVE LOAD 12KW.','/projects/9',1,'2026-07-10 10:58:33'),(6,13,'Task Assigned','You have been assigned the task \'Mechanical\' in 40 Pos Test Bench 03.','/projects/6',1,'2026-07-10 11:05:57'),(7,11,'Task Assigned','You have been assigned the task \'Scanner Board Testing\' in 40 Pos Test Bench 03.','/projects/6',1,'2026-07-10 11:06:44'),(8,14,'Task Assigned','You have been assigned the task \'WIRING\' in RESISTIVE LIVE LOAD 12KW.','/projects/9',0,'2026-07-10 11:13:58'),(9,13,'Task Assigned','You have been assigned the task \'WIRING\' in RESISTIVE LIVE LOAD 12KW.','/projects/9',1,'2026-07-10 11:14:55'),(10,14,'Task Assigned','You have been assigned the task \'WIRING\' in RESISTIVE LIVE LOAD 12KW.','/projects/9',0,'2026-07-10 11:15:00'),(11,2,'New BOM Created','A new BOM \'BOM 1\' has been created and is ready for review.','/bom',1,'2026-07-10 11:18:27'),(12,10,'New BOM Created','A new BOM \'BOM 1\' has been created and is ready for review.','/bom',0,'2026-07-10 11:18:27'),(13,12,'New BOM Created','A new BOM \'BOM 1\' has been created and is ready for review.','/bom',0,'2026-07-10 11:18:27'),(14,10,'Task Assigned','You have been assigned the task \'LDU BOM\' in 40 Pos Test Bench 03.','/projects/6',0,'2026-07-10 11:27:30'),(15,6,'Task Assigned','You have been assigned the task \'TESTING\' in RESISTIVE LIVE LOAD 12KW.','/projects/9',1,'2026-07-13 05:13:08'),(16,10,'New BOM Created','A new BOM \'Dummy\' has been created and is ready for review.','/bom',0,'2026-07-14 06:09:24'),(17,16,'New BOM Created','A new BOM \'Dummy\' has been created and is ready for review.','/bom',0,'2026-07-14 06:09:24'),(18,12,'New BOM Created','A new BOM \'Dummy\' has been created and is ready for review.','/bom',0,'2026-07-14 06:09:24'),(19,2,'New BOM Created','A new BOM \'Dummy\' has been created and is ready for review.','/bom',0,'2026-07-14 06:09:24');
/*!40000 ALTER TABLE `notifications` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `product_locations`
--

DROP TABLE IF EXISTS `product_locations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `product_locations` (
  `product_id` int NOT NULL,
  `location_id` int NOT NULL,
  `quantity` decimal(10,2) NOT NULL DEFAULT '0.00',
  PRIMARY KEY (`product_id`,`location_id`),
  KEY `location_id` (`location_id`),
  KEY `idx_product_locations_product` (`product_id`),
  CONSTRAINT `product_locations_ibfk_1` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE,
  CONSTRAINT `product_locations_ibfk_2` FOREIGN KEY (`location_id`) REFERENCES `locations` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `product_locations`
--

LOCK TABLES `product_locations` WRITE;
/*!40000 ALTER TABLE `product_locations` DISABLE KEYS */;
INSERT INTO `product_locations` VALUES (9,1,50.00),(11,4,0.00),(12,7,0.00);
/*!40000 ALTER TABLE `product_locations` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `product_vendors`
--

DROP TABLE IF EXISTS `product_vendors`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `product_vendors` (
  `product_id` int NOT NULL,
  `vendor_id` int NOT NULL,
  `is_preferred` tinyint(1) DEFAULT '0',
  PRIMARY KEY (`product_id`,`vendor_id`),
  KEY `vendor_id` (`vendor_id`),
  CONSTRAINT `product_vendors_ibfk_1` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE,
  CONSTRAINT `product_vendors_ibfk_2` FOREIGN KEY (`vendor_id`) REFERENCES `vendors` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `product_vendors`
--

LOCK TABLES `product_vendors` WRITE;
/*!40000 ALTER TABLE `product_vendors` DISABLE KEYS */;
INSERT INTO `product_vendors` VALUES (9,1,1);
/*!40000 ALTER TABLE `product_vendors` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `products`
--

DROP TABLE IF EXISTS `products`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `products` (
  `id` int NOT NULL AUTO_INCREMENT,
  `code` varchar(100) NOT NULL,
  `name` varchar(255) NOT NULL,
  `description` text,
  `category` varchar(100) DEFAULT NULL,
  `unit` varchar(50) DEFAULT 'pcs',
  `min_quantity` decimal(10,2) DEFAULT '0.00',
  `max_quantity` decimal(10,2) DEFAULT '0.00',
  `barcode` varchar(100) DEFAULT NULL,
  `qr_code` varchar(100) DEFAULT NULL,
  `image_url` text,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `manufacturer` varchar(255) DEFAULT NULL,
  `link` text,
  `standard_cost` decimal(12,2) DEFAULT '0.00',
  `latest_cost` decimal(12,2) DEFAULT '0.00',
  `average_cost` decimal(12,2) DEFAULT '0.00',
  `currency` varchar(10) DEFAULT 'INR',
  PRIMARY KEY (`id`),
  UNIQUE KEY `code` (`code`),
  KEY `idx_products_code` (`code`),
  KEY `idx_products_name` (`name`)
) ENGINE=InnoDB AUTO_INCREMENT=13 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `products`
--

LOCK TABLES `products` WRITE;
/*!40000 ALTER TABLE `products` DISABLE KEYS */;
INSERT INTO `products` VALUES (9,'CON-SCH','Contactor 3P 25A 440V','{\"schemaVersion\":1,\"categoryId\":\"CONTACTOR\",\"specifications\":{\"manufacturer\":\"Schneider Electric\",\"partNumber\":\"LC1D25M7\",\"series\":\"\",\"model\":\"\",\"coilVoltage\":\"440V\",\"current\":\"25A\",\"poles\":\"3P\",\"utilizationCategory\":\"\"},\"store\":{\"reorderLevel\":\"20\",\"rack\":\"A1\",\"shelf\":\"Shelf 1\",\"bin\":\"Bin 1\",\"warehouse\":\"Main Store\",\"zone\":\"Zone A\",\"remarks\":\"\",\"standardCost\":\"3421\",\"currency\":\"INR\"},\"additional\":{\"supplier\":\"1\",\"supplierPartNumber\":\"\",\"manufacturerPartNumber\":\"LC1D25M7\",\"catalogNumber\":\"LC1D25M7\",\"warranty\":\"\",\"countryOfOrigin\":\"\",\"datasheetUrl\":\"https://assets.rs-online.com/v1696934226/Datasheets/7f4f4a8b56e5c37d6f3f470796d3c248.pdf\",\"notes\":\"\"}}','Contactor','Nos',10.00,20.00,'LC1D25M7','CON-SCH','data:image/jpeg;base64,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','2026-07-10 04:48:35',NULL,NULL,3421.00,0.00,0.00,'INR'),(11,'CAP-01UF-50V','Capacitor 1206 0.1uF 50V X7R 10%','{\"schemaVersion\":1,\"categoryId\":\"CAPACITOR\",\"specifications\":{\"manufacturer\":\"KEMET\",\"partNumber\":\"C1206C104K5RAC\",\"series\":\"\",\"model\":\"1206\",\"capacitance\":\"0.1uF\",\"voltage\":\"50V\",\"dielectric\":\"X7R\",\"tolerance\":\"10%\"},\"store\":{\"reorderLevel\":\"20\",\"rack\":\"A2\",\"shelf\":\"Shelf 1\",\"bin\":\"Bin 1\",\"warehouse\":\"Main Store\",\"zone\":\"Zone A\",\"remarks\":\"\",\"standardCost\":\"0.00\",\"currency\":\"INR\"},\"additional\":{\"supplier\":\"\",\"supplierPartNumber\":\"\",\"manufacturerPartNumber\":\"C1206C104K5RAC\",\"catalogNumber\":\"C1206C104K5RAC\",\"warranty\":\"\",\"countryOfOrigin\":\"\",\"datasheetUrl\":\"https://www.alldatasheet.com/datasheet-pdf/pdf/188708/KEMET/C1206C104K5RAC.html\",\"notes\":\"No Minimum Order Requirement. Free Shipping On All Orders Over ₹7,000. Order Today! Leading The Industry in Product Availability, Speed of Service, Responsiveness, and More. | C1206C104K5RACKEMET Multilayer Ceramic Capacitors MLCC - SMD/SMT 50V 0.1uF...\"}}','Capacitor','Nos',10.00,20.00,'C1206C104K5RAC','CAP-01UF-50V','','2026-07-10 09:08:07',NULL,NULL,0.00,0.00,0.00,'INR'),(12,'CAP-1F-63V','Capacitor 1 µF 63V ± 20%','{\"schemaVersion\":1,\"categoryId\":\"CAPACITOR\",\"specifications\":{\"manufacturer\":\"Unknown\",\"partNumber\":\"MCRH63V105M5X11\",\"series\":\"\",\"model\":\"\",\"capacitance\":\"1 µF\",\"voltage\":\"63V\",\"dielectric\":\"\",\"tolerance\":\"± 20%\"},\"store\":{\"reorderLevel\":\"20\",\"rack\":\"A2\",\"shelf\":\"Shelf 1\",\"bin\":\"Bin 2\",\"warehouse\":\"Main Store\",\"zone\":\"Zone A\",\"remarks\":\"\",\"standardCost\":\"0.00\",\"currency\":\"INR\"},\"additional\":{\"supplier\":\"\",\"supplierPartNumber\":\"\",\"manufacturerPartNumber\":\"MCRH63V105M5X11\",\"catalogNumber\":\"MCRH63V105M5X11\",\"warranty\":\"\",\"countryOfOrigin\":\"\",\"datasheetUrl\":\"\",\"notes\":\"Details for part number MCRH63V105M5X11.\"}}','Capacitor','Nos',10.00,20.00,'MCRH63V105M5X11','CAP-1F-63V','','2026-07-10 09:19:28',NULL,NULL,0.00,0.00,0.00,'INR');
/*!40000 ALTER TABLE `products` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `project_activities`
--

DROP TABLE IF EXISTS `project_activities`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `project_activities` (
  `id` int NOT NULL AUTO_INCREMENT,
  `project_id` int DEFAULT NULL,
  `action` varchar(255) NOT NULL,
  `description` text,
  `user_id` int DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `project_id` (`project_id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `project_activities_ibfk_1` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`) ON DELETE CASCADE,
  CONSTRAINT `project_activities_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `employees` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=88 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `project_activities`
--

LOCK TABLES `project_activities` WRITE;
/*!40000 ALTER TABLE `project_activities` DISABLE KEYS */;
INSERT INTO `project_activities` VALUES (1,6,'PROJECT_CREATED','Project 431/PRJ/0726 created',2,'2026-07-08 05:54:16'),(2,6,'TASK_CREATED','Created task: BOM Preparation',2,'2026-07-08 05:55:13'),(3,6,'TASK_CREATED','Created task: Electrical',2,'2026-07-08 06:47:50'),(4,6,'TASK_CREATED','Created task: Electronics',2,'2026-07-08 06:47:55'),(5,6,'TASK_DELETED','Deleted task: Electrical',2,'2026-07-08 07:38:54'),(6,6,'TASK_UPDATED','Updated task status for \'BOM Preparation\' to REVIEW',2,'2026-07-08 08:02:26'),(7,6,'TASK_UPDATED','Updated task status for \'BOM Preparation\' to TODO',2,'2026-07-08 08:02:28'),(8,6,'TASK_UPDATED','Updated task status for \'BOM Preparation\' to IN_PROGRESS',2,'2026-07-08 09:46:56'),(9,6,'TASK_UPDATED','Updated task status for \'BOM Preparation\' to TODO',2,'2026-07-08 09:47:00'),(10,6,'TASK_UPDATED','Updated task status for \'BOM Preparation\' to IN_PROGRESS',2,'2026-07-08 09:47:03'),(11,6,'TASK_UPDATED','Updated task status for \'BOM Preparation\' to TODO',2,'2026-07-08 09:54:44'),(12,6,'TASK_CREATED','Created task: Mechanical',2,'2026-07-08 09:55:17'),(13,6,'TASK_UPDATED','Updated task status for \'BOM Preparation\' to IN_PROGRESS',2,'2026-07-08 09:57:02'),(14,6,'TASK_UPDATED','Updated task status for \'BOM Preparation\' to TODO',2,'2026-07-08 10:05:04'),(15,6,'TASK_CREATED','Created task: Task 1',2,'2026-07-08 10:27:42'),(16,6,'TASK_CREATED','Created task: Project Discussion',2,'2026-07-09 08:42:42'),(17,6,'TASK_UPDATED','Updated task status for \'Project Discussion\' to IN_PROGRESS',2,'2026-07-09 08:42:45'),(18,6,'TASK_DELETED','Deleted task: Task 1',2,'2026-07-09 08:42:50'),(19,6,'TASK_CREATED','Created task: 1',10,'2026-07-09 10:03:57'),(20,6,'TASK_DELETED','Deleted task: 1',10,'2026-07-09 10:04:01'),(21,6,'TASK_UPDATED','Updated task status for \'BOM Preparation\' to IN_PROGRESS',10,'2026-07-09 10:04:08'),(22,6,'TASK_UPDATED','Updated task status for \'BOM Preparation\' to TODO',10,'2026-07-09 10:04:12'),(23,6,'TASK_UPDATED','Updated task status for \'BOM Preparation\' to IN_PROGRESS',10,'2026-07-09 10:04:20'),(24,6,'TASK_UPDATED','Updated task status for \'Project Discussion\' to TODO',10,'2026-07-09 10:04:23'),(25,6,'TASK_UPDATED','Updated task status for \'BOM Preparation\' to COMPLETED',10,'2026-07-09 10:04:26'),(26,6,'TASK_UPDATED','Updated task status for \'BOM Preparation\' to IN_PROGRESS',10,'2026-07-09 10:04:27'),(27,6,'TASK_UPDATED','Updated task status for \'Project Discussion\' to IN_PROGRESS',10,'2026-07-09 10:04:38'),(28,6,'TASK_UPDATED','Updated task status for \'Project Discussion\' to TODO',10,'2026-07-09 10:04:40'),(29,6,'TASK_CREATED','Created task: task 1',10,'2026-07-09 10:05:07'),(30,6,'TASK_CREATED','Created task: task 2',10,'2026-07-09 10:05:16'),(31,6,'TASK_CREATED','Created task: task3',10,'2026-07-09 10:05:49'),(32,6,'TASK_DELETED','Deleted task: task 1',12,'2026-07-09 10:56:01'),(33,6,'TASK_DELETED','Deleted task: task3',12,'2026-07-09 10:56:03'),(34,6,'TASK_CREATED','Created task: Procurement',12,'2026-07-09 10:56:12'),(35,6,'TASK_UPDATED','Updated task status for \'Procurement\' to IN_PROGRESS',12,'2026-07-09 10:56:18'),(36,6,'TASK_CREATED','Created task: LDU Board Flashing',2,'2026-07-09 12:31:00'),(37,6,'TASK_UPDATED','Updated task status for \'Electronics\' to REVIEW',2,'2026-07-10 09:27:27'),(38,6,'TASK_UPDATED','Updated task status for \'Electronics\' to TODO',2,'2026-07-10 09:27:29'),(39,6,'TASK_UPDATED','Updated task status for \'Project Discussion\' to IN_PROGRESS',2,'2026-07-10 09:27:58'),(40,6,'TASK_UPDATED','Updated task status for \'Procurement\' to TODO',2,'2026-07-10 09:28:01'),(41,6,'FILE_UPLOADED','Uploaded files for task: Activity Sheet',2,'2026-07-10 09:32:58'),(42,6,'FILE_UPLOADED','Uploaded files for task: Activity Sheet',2,'2026-07-10 10:24:02'),(43,6,'FILE_UPLOADED','Uploaded files for task: Activity Sheet',2,'2026-07-10 10:24:06'),(44,6,'FILE_DELETED','Deleted file: LDU BOM.xlsx',2,'2026-07-10 10:24:08'),(45,6,'FILE_DELETED','Deleted file: GENUS CONVEYOR - Revised.pptx',2,'2026-07-10 10:24:14'),(46,6,'FILE_DELETED','Deleted file: Industrial_Camera_Comparison_Raspberry_Pi.pdf',2,'2026-07-10 10:24:16'),(47,6,'FILE_UPLOADED','Uploaded files for task: Activity Sheet',2,'2026-07-10 10:25:40'),(48,6,'FILE_DELETED','Deleted file: GENUS CONVEYOR - Revised.pptx',2,'2026-07-10 10:25:42'),(58,9,'PROJECT_CREATED','Project 429/PRJ/0626 created',11,'2026-07-10 10:53:45'),(59,9,'TASK_CREATED','Created task: TASK 1',11,'2026-07-10 10:58:28'),(60,6,'FILE_UPLOADED','Uploaded files for task: Activity Sheet',2,'2026-07-10 11:00:44'),(61,6,'FILE_DELETED','Deleted file: GENUS CONVEYOR - Revised_v1.pptx',2,'2026-07-10 11:00:47'),(62,6,'TASK_DELETED','Deleted task: Project Discussion',2,'2026-07-10 11:06:00'),(63,6,'TASK_UPDATED','Updated task status for \'Procurement\' to IN_PROGRESS',2,'2026-07-10 11:06:10'),(64,6,'TASK_UPDATED','Updated task status for \'Electronics\' to IN_PROGRESS',2,'2026-07-10 11:06:16'),(65,6,'TASK_UPDATED','Updated task status for \'Mechanical\' to IN_PROGRESS',2,'2026-07-10 11:06:17'),(66,6,'TASK_CREATED','Created task: Display Flashing',2,'2026-07-10 11:06:26'),(67,6,'TASK_CREATED','Created task: Scanner Board Testing',2,'2026-07-10 11:06:39'),(68,6,'TASK_UPDATED','Updated task status for \'Mechanical\' to REVIEW',2,'2026-07-10 11:13:56'),(69,6,'TASK_UPDATED','Updated task status for \'Mechanical\' to IN_PROGRESS',2,'2026-07-10 11:14:00'),(70,9,'TASK_CREATED','Created task: sdgdsg',11,'2026-07-10 11:15:30'),(71,9,'TASK_DELETED','Deleted task: sdgdsg',11,'2026-07-10 11:15:46'),(72,9,'TASK_UPDATED','Updated task status for \'WIRING\' to REVIEW',11,'2026-07-10 11:16:14'),(73,9,'TASK_UPDATED','Updated task status for \'WIRING\' to COMPLETED',11,'2026-07-10 11:16:18'),(74,9,'TASK_CREATED','Created task: TESTING',11,'2026-07-10 11:21:01'),(75,9,'TASK_CREATED','Created task: PACKING',11,'2026-07-10 11:21:06'),(76,9,'TASK_CREATED','Created task: DISPATCH',11,'2026-07-10 11:21:11'),(77,9,'TASK_UPDATED','Updated task status for \'TESTING\' to IN_PROGRESS',11,'2026-07-10 11:21:19'),(78,9,'TASK_DELETED','Deleted task: PACKING',11,'2026-07-10 11:24:10'),(79,9,'TASK_DELETED','Deleted task: DISPATCH',11,'2026-07-10 11:24:14'),(80,9,'TASK_UPDATED','Updated task status for \'TESTING\' to TODO',11,'2026-07-10 11:24:25'),(81,9,'TASK_UPDATED','Updated task status for \'WIRING\' to IN_PROGRESS',11,'2026-07-10 11:24:46'),(82,6,'TASK_CREATED','Created task: LDU BOM',6,'2026-07-10 11:26:55'),(83,6,'TASK_UPDATED','Updated task status for \'LDU BOM\' to COMPLETED',2,'2026-07-10 11:27:42'),(84,9,'STATUS_CHANGED','Project status changed to IN_PROGRESS',2,'2026-07-10 11:27:52'),(86,6,'TASK_UPDATED','Updated task status for \'Electronics\' to COMPLETED',8,'2026-07-13 09:58:03'),(87,6,'TASK_UPDATED','Updated task status for \'Electronics\' to IN_PROGRESS',8,'2026-07-13 09:58:10');
/*!40000 ALTER TABLE `project_activities` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `project_files`
--

DROP TABLE IF EXISTS `project_files`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `project_files` (
  `id` int NOT NULL AUTO_INCREMENT,
  `project_id` int DEFAULT NULL,
  `task_name` varchar(100) DEFAULT NULL,
  `file_name` varchar(255) DEFAULT NULL,
  `file_path` varchar(500) DEFAULT NULL,
  `uploaded_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `project_id` (`project_id`),
  CONSTRAINT `project_files_ibfk_1` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `project_files`
--

LOCK TABLES `project_files` WRITE;
/*!40000 ALTER TABLE `project_files` DISABLE KEYS */;
/*!40000 ALTER TABLE `project_files` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `project_milestones`
--

DROP TABLE IF EXISTS `project_milestones`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `project_milestones` (
  `id` int NOT NULL AUTO_INCREMENT,
  `project_id` int NOT NULL,
  `name` varchar(255) NOT NULL,
  `description` text,
  `associated_task_id` int DEFAULT NULL,
  `target_date` date DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `project_id` (`project_id`),
  CONSTRAINT `project_milestones_ibfk_1` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `project_milestones`
--

LOCK TABLES `project_milestones` WRITE;
/*!40000 ALTER TABLE `project_milestones` DISABLE KEYS */;
/*!40000 ALTER TABLE `project_milestones` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `project_notes`
--

DROP TABLE IF EXISTS `project_notes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `project_notes` (
  `id` int NOT NULL AUTO_INCREMENT,
  `project_id` int DEFAULT NULL,
  `content` text NOT NULL,
  `created_by` int DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `project_id` (`project_id`),
  KEY `created_by` (`created_by`),
  CONSTRAINT `project_notes_ibfk_1` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`) ON DELETE CASCADE,
  CONSTRAINT `project_notes_ibfk_2` FOREIGN KEY (`created_by`) REFERENCES `employees` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `project_notes`
--

LOCK TABLES `project_notes` WRITE;
/*!40000 ALTER TABLE `project_notes` DISABLE KEYS */;
/*!40000 ALTER TABLE `project_notes` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `project_risks`
--

DROP TABLE IF EXISTS `project_risks`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `project_risks` (
  `id` int NOT NULL AUTO_INCREMENT,
  `project_id` int NOT NULL,
  `risk_description` text NOT NULL,
  `impact_level` varchar(20) DEFAULT 'MEDIUM',
  `probability_level` varchar(20) DEFAULT 'MEDIUM',
  `mitigation_strategy` text,
  PRIMARY KEY (`id`),
  KEY `project_id` (`project_id`),
  CONSTRAINT `project_risks_ibfk_1` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `project_risks`
--

LOCK TABLES `project_risks` WRITE;
/*!40000 ALTER TABLE `project_risks` DISABLE KEYS */;
/*!40000 ALTER TABLE `project_risks` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `project_tasks`
--

DROP TABLE IF EXISTS `project_tasks`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `project_tasks` (
  `id` int NOT NULL AUTO_INCREMENT,
  `project_id` int DEFAULT NULL,
  `task_name` varchar(100) DEFAULT NULL,
  `status` varchar(50) DEFAULT 'PENDING',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `project_id` (`project_id`),
  CONSTRAINT `project_tasks_ibfk_1` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=89 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `project_tasks`
--

LOCK TABLES `project_tasks` WRITE;
/*!40000 ALTER TABLE `project_tasks` DISABLE KEYS */;
INSERT INTO `project_tasks` VALUES (38,6,'Activity Sheet','COMPLETED','2026-07-08 05:54:16'),(39,6,'BOM','PENDING','2026-07-08 05:54:16'),(40,6,'Schematic','PENDING','2026-07-08 05:54:16'),(41,6,'Mechanical Drawing','PENDING','2026-07-08 05:54:16'),(42,6,'Test Report','PENDING','2026-07-08 05:54:16'),(43,6,'Service Report','PENDING','2026-07-08 05:54:16'),(44,6,'Installation Report','PENDING','2026-07-08 05:54:16'),(45,6,'User Manual','PENDING','2026-07-08 05:54:16'),(46,6,'Photos','PENDING','2026-07-08 05:54:16'),(47,6,'Technical Specification','PENDING','2026-07-08 05:54:16'),(48,6,'Software','PENDING','2026-07-08 05:54:16'),(69,9,'Activity Sheet','PENDING','2026-07-10 10:53:45'),(70,9,'BOM','PENDING','2026-07-10 10:53:45'),(71,9,'Schematic','PENDING','2026-07-10 10:53:45'),(72,9,'Mechanical Drawing','PENDING','2026-07-10 10:53:45'),(73,9,'Test Report','PENDING','2026-07-10 10:53:45'),(74,9,'Service Report','PENDING','2026-07-10 10:53:45'),(75,9,'Installation Report','PENDING','2026-07-10 10:53:45'),(76,9,'User Manual','PENDING','2026-07-10 10:53:45'),(77,9,'Photos','PENDING','2026-07-10 10:53:45'),(78,9,'Technical Specification','PENDING','2026-07-10 10:53:45');
/*!40000 ALTER TABLE `project_tasks` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `projects`
--

DROP TABLE IF EXISTS `projects`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `projects` (
  `id` int NOT NULL AUTO_INCREMENT,
  `code` varchar(100) NOT NULL,
  `name` varchar(255) NOT NULL,
  `po_number` varchar(255) DEFAULT NULL,
  `client_name` varchar(255) DEFAULT NULL,
  `description` text,
  `status` varchar(50) DEFAULT 'PLANNING',
  `start_date` date DEFAULT NULL,
  `end_date` date DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `project_incharge` varchar(255) DEFAULT NULL,
  `has_software` tinyint(1) DEFAULT '0',
  `has_firmware` tinyint(1) DEFAULT '0',
  `has_transformer` tinyint(1) DEFAULT '0',
  `no_of_panels` int DEFAULT '1',
  `folder_path` varchar(500) DEFAULT NULL,
  `date_of_delivery` date DEFAULT NULL,
  `constraints` text,
  `budget` decimal(15,2) DEFAULT NULL,
  `priority` varchar(20) DEFAULT 'MEDIUM',
  PRIMARY KEY (`id`),
  UNIQUE KEY `code` (`code`)
) ENGINE=InnoDB AUTO_INCREMENT=455 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `projects`
--

LOCK TABLES `projects` WRITE;
/*!40000 ALTER TABLE `projects` DISABLE KEYS */;
INSERT INTO `projects` VALUES (6,'430/PRJ/0726','40 Pos Test Bench 03','','Fuji Electic',NULL,'PLANNING','2026-07-08',NULL,'2026-07-08 05:54:16','',1,1,0,9,'Z:\\PROJECTS\\Project No 430_Fuji Electic_40 Pos Test Bench 03','2026-09-25',NULL,NULL,'MEDIUM'),(9,'429/PRJ/0626','RESISTIVE LIVE LOAD 12KW','','T D POWER SYSTEMS',NULL,'IN_PROGRESS','2026-07-10',NULL,'2026-07-10 10:53:44','Aravind',0,0,0,5,'Z:\\PROJECTS\\Project No 429_T D POWER SYSTEMS_RESISTIVE LIVE LOAD 12KW','2026-07-31',NULL,NULL,'MEDIUM');
/*!40000 ALTER TABLE `projects` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `purchase_requests`
--

DROP TABLE IF EXISTS `purchase_requests`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `purchase_requests` (
  `id` int NOT NULL AUTO_INCREMENT,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `requester` varchar(255) NOT NULL,
  `product_id` int DEFAULT NULL,
  `quantity` decimal(10,2) NOT NULL,
  `status` varchar(50) DEFAULT 'PENDING',
  `remarks` text,
  `approved_at` timestamp NULL DEFAULT NULL,
  `delivered_at` timestamp NULL DEFAULT NULL,
  `change_remarks` text,
  `history_logs` text,
  PRIMARY KEY (`id`),
  KEY `product_id` (`product_id`),
  CONSTRAINT `purchase_requests_ibfk_1` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `purchase_requests`
--

LOCK TABLES `purchase_requests` WRITE;
/*!40000 ALTER TABLE `purchase_requests` DISABLE KEYS */;
/*!40000 ALTER TABLE `purchase_requests` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `resource_suggestions`
--

DROP TABLE IF EXISTS `resource_suggestions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `resource_suggestions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `task_id` int NOT NULL,
  `suggested_role` varchar(100) DEFAULT NULL,
  `required_skills` text,
  PRIMARY KEY (`id`),
  KEY `task_id` (`task_id`),
  CONSTRAINT `resource_suggestions_ibfk_1` FOREIGN KEY (`task_id`) REFERENCES `dynamic_tasks` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `resource_suggestions`
--

LOCK TABLES `resource_suggestions` WRITE;
/*!40000 ALTER TABLE `resource_suggestions` DISABLE KEYS */;
/*!40000 ALTER TABLE `resource_suggestions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `service_tickets`
--

DROP TABLE IF EXISTS `service_tickets`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `service_tickets` (
  `id` int NOT NULL AUTO_INCREMENT,
  `project_id` int NOT NULL,
  `title` varchar(255) NOT NULL,
  `description` text,
  `status` varchar(50) DEFAULT 'OPEN',
  `resolution_notes` text,
  `resolution_time_mins` int DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `project_id` (`project_id`),
  CONSTRAINT `service_tickets_ibfk_1` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `service_tickets`
--

LOCK TABLES `service_tickets` WRITE;
/*!40000 ALTER TABLE `service_tickets` DISABLE KEYS */;
/*!40000 ALTER TABLE `service_tickets` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `task_dependencies`
--

DROP TABLE IF EXISTS `task_dependencies`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `task_dependencies` (
  `id` int NOT NULL AUTO_INCREMENT,
  `task_id` int NOT NULL,
  `depends_on_task_id` int NOT NULL,
  `dependency_type` varchar(20) DEFAULT 'FS',
  `lag_days` int DEFAULT '0',
  PRIMARY KEY (`id`),
  KEY `task_id` (`task_id`),
  KEY `depends_on_task_id` (`depends_on_task_id`),
  CONSTRAINT `task_dependencies_ibfk_1` FOREIGN KEY (`task_id`) REFERENCES `dynamic_tasks` (`id`) ON DELETE CASCADE,
  CONSTRAINT `task_dependencies_ibfk_2` FOREIGN KEY (`depends_on_task_id`) REFERENCES `dynamic_tasks` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `task_dependencies`
--

LOCK TABLES `task_dependencies` WRITE;
/*!40000 ALTER TABLE `task_dependencies` DISABLE KEYS */;
/*!40000 ALTER TABLE `task_dependencies` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `vendors`
--

DROP TABLE IF EXISTS `vendors`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `vendors` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `contact_person` varchar(255) DEFAULT NULL,
  `phone` varchar(50) DEFAULT NULL,
  `email` varchar(255) DEFAULT NULL,
  `address` text,
  `gst_number` varchar(100) DEFAULT NULL,
  `is_preferred` tinyint(1) DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `vendors`
--

LOCK TABLES `vendors` WRITE;
/*!40000 ALTER TABLE `vendors` DISABLE KEYS */;
INSERT INTO `vendors` VALUES (1,'Internal Stock Update','','','','','',0,'2026-06-25 09:59:31');
/*!40000 ALTER TABLE `vendors` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping routines for database 'smart_store'
--
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-07-14 17:52:28
