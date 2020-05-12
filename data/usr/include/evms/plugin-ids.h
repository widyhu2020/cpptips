/*
 *
 *   (C) Copyright IBM Corp. 2005
 *
 *   This program is free software;  you can redistribute it and/or modify
 *   it under the terms of the GNU General Public License as published by
 *   the Free Software Foundation; either version 2 of the License, or
 *   (at your option) any later version.
 *
 *   This program is distributed in the hope that it will be useful,
 *   but WITHOUT ANY WARRANTY;  without even the implied warranty of
 *   MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See
 *   the GNU General Public License for more details.
 *
 *   You should have received a copy of the GNU General Public License
 *   along with this program;  if not, write to the Free Software
 *   Foundation, Inc., 59 Temple Place, Suite 330, Boston, MA 02111-1307 USA
 *
 * Module: plugin-ids.h
 */

#ifndef EVMS_PLUGINIDS_H_INCLUDED
#define EVMS_PLUGINIDS_H_INCLUDED 1

/*********\
* OEM IDs *
\*********/

#define EVMS_IBM_OEM_ID                 8112    // could be anything, but used
						// I=8, B=1, M=12
#define EVMS_IBM_OEM_NAME		"IBM"

#define EVMS_NOVELL_OEM_ID		20041
#define EVMS_NOVELL_OEM_NAME		"Novell"

#define EVMS_ALT_LINUX_OEM_ID		795
#define EVMS_ALT_LINUX_OEM_NAME		"ALT Linux"


/*****************\
* Device Managers *
\*****************/

#define EVMS_DISK_PLUGIN_ID 			SetPluginID(EVMS_IBM_OEM_ID,	\
							    EVMS_DEVICE_MANAGER,\
							    2)
#define EVMS_DISK_PLUGIN_SHORT_NAME		"LocalDskMgr"
#define EVMS_DISK_PLUGIN_LONG_NAME		"Local Disk Manager"

#define EVMS_ERROR_PLUGIN_ID			SetPluginID(EVMS_IBM_OEM_ID,	\
							    EVMS_DEVICE_MANAGER,\
							    3)
#define EVMS_ERROR_PLUGIN_SHORT_NAME		"Error"
#define EVMS_ERROR_PLUGIN_LONG_NAME    		"Error Device Manager"

/*
 * Ok, it's not really a device manager.  We use the device manager plug-in type
 * so that the plug-in gets called only once during discovery.  On discovery,
 * the replace plug-in finds any old device-mapper mirror maps that were used
 * for replace and removes the maps.  Segment managers and region managers can
 * get called multiple times.  It would be a waste to call the replace plug-in
 * several times during discovery.  EVMS features only get called for discovery
 * if an object has a feature header and the feature header has the plug-in's
 * ID.  The replace plug-in should always be called on discovery, so being a
 * feature won't do.
 */
#define EVMS_REPLACE_PLUGIN_ID			SetPluginID(EVMS_IBM_OEM_ID,	\
							    EVMS_DEVICE_MANAGER,\
							    12)
#define EVMS_REPLACE_PLUGIN_SHORT_NAME		"Replace"
#define EVMS_REPLACE_PLUGIN_LONG_NAME		"EVMS Replace"


/******************\
* Segment Managers *
\******************/

#define EVMS_DOS_PLUGIN_ID			SetPluginID(EVMS_IBM_OEM_ID,	 \
							    EVMS_SEGMENT_MANAGER,\
							    1)
#define EVMS_DOS_PLUGIN_SHORT_NAME		"DosSegMgr"
#define EVMS_DOS_PLUGIN_LONG_NAME      		"DOS Segment Manager"

#define EVMS_S390_PLUGIN_ID			SetPluginID(EVMS_IBM_OEM_ID,	 \
							    EVMS_SEGMENT_MANAGER,\
							    2)
#define EVMS_S390_PLUGIN_SHORT_NAME		"S390SegMgr"
#define EVMS_S390_PLUGIN_LONG_NAME      	"S390 Segment Manager"

#define EVMS_GPT_PLUGIN_ID			SetPluginID(EVMS_IBM_OEM_ID,	 \
							    EVMS_SEGMENT_MANAGER,\
							    3)
#define EVMS_GPT_PLUGIN_SHORT_NAME		"GptSegMgr"
#define EVMS_GPT_PLUGIN_LONG_NAME      		"GPT Segment Manager"

#define EVMS_CSM_PLUGIN_ID			SetPluginID(EVMS_IBM_OEM_ID,	 \
							    EVMS_SEGMENT_MANAGER,\
							    5)
#define EVMS_CSM_PLUGIN_SHORT_NAME     		"CSM"
#define EVMS_CSM_PLUGIN_LONG_NAME      		"Cluster Segment Manager"

#define EVMS_BBR_SEG_PLUGIN_ID			SetPluginID(EVMS_IBM_OEM_ID,	 \
							    EVMS_SEGMENT_MANAGER,\
							    6)
#define EVMS_BBR_SEG_PLUGIN_SHORT_NAME		"BBRseg"
#define EVMS_BBR_SEG_PLUGIN_LONG_NAME		"Bad Block Relocation Segment Manager"

#define EVMS_BSD_PLUGIN_ID			SetPluginID(EVMS_IBM_OEM_ID,	 \
							    EVMS_SEGMENT_MANAGER,\
							    7)
#define EVMS_BSD_PLUGIN_SHORT_NAME		"BSD"
#define EVMS_BSD_PLUGIN_LONG_NAME		"BSD Segment Manager"

#define EVMS_MAC_PLUGIN_ID			SetPluginID(EVMS_IBM_OEM_ID,	 \
							    EVMS_SEGMENT_MANAGER,\
							    8)
#define EVMS_MAC_PLUGIN_SHORT_NAME		"MAC"
#define EVMS_MAC_PLUGIN_LONG_NAME      		"MAC Segment Manager"

#define EVMS_MULTIPATH_PLUGIN_ID		SetPluginID(EVMS_IBM_OEM_ID,	 \
							    EVMS_SEGMENT_MANAGER,\
							    9)
#define EVMS_MULTIPATH_PLUGIN_SHORT_NAME	"Multipath"
#define EVMS_MULTIPATH_PLUGIN_LONG_NAME		"Multipath Segment Manager"

#define EVMS_TEMPLATE_PLUGIN_ID			SetPluginID(EVMS_IBM_OEM_ID,	 \
							    EVMS_SEGMENT_MANAGER,\
							    10)
#define EVMS_TEMPLATE_PLUGIN_SHORT_NAME		"Template"
#define EVMS_TEMPLATE_PLUGIN_LONG_NAME		"Template Segment Manager"


/*****************\
* Region Managers *
\*****************/

#define EVMS_LVM_PLUGIN_ID			SetPluginID(EVMS_IBM_OEM_ID,	\
							    EVMS_REGION_MANAGER,\
							    1)
#define EVMS_LVM_PLUGIN_SHORT_NAME		"LvmRegMgr"
#define EVMS_LVM_PLUGIN_LONG_NAME      		"LVM Region Manager"

#define EVMS_MD_LINEAR_PLUGIN_ID		SetPluginID(EVMS_IBM_OEM_ID,	\
							    EVMS_REGION_MANAGER,\
							    4)
#define EVMS_MD_LINEAR_PLUGIN_SHORT_NAME	"MDLinearRegMgr"
#define EVMS_MD_LINEAR_PLUGIN_LONG_NAME		"MD Linear Raid Region Manager"

#define EVMS_MD_RAID1_PLUGIN_ID			SetPluginID(EVMS_IBM_OEM_ID,	\
							    EVMS_REGION_MANAGER,\
							    5)
#define EVMS_MD_RAID1_PLUGIN_SHORT_NAME 	"MDRaid1RegMgr"
#define EVMS_MD_RAID1_PLUGIN_LONG_NAME		"MD Raid 1 Region Manager"

#define EVMS_MD_RAID0_PLUGIN_ID			SetPluginID(EVMS_IBM_OEM_ID,	\
							    EVMS_REGION_MANAGER,\
							    6)
#define EVMS_MD_RAID0_PLUGIN_SHORT_NAME		"MDRaid0RegMgr"
#define EVMS_MD_RAID0_PLUGIN_LONG_NAME		"MD RAID0 Region Manager"

#define EVMS_MD_RAID5_PLUGIN_ID			SetPluginID(EVMS_IBM_OEM_ID,	\
							    EVMS_REGION_MANAGER,\
							    7)
#define EVMS_MD_RAID5_PLUGIN_SHORT_NAME		"MDRaid5RegMgr"
#define EVMS_MD_RAID5_PLUGIN_LONG_NAME		"MD RAID 4/5 Region Manager"

#define EVMS_MD_MULTIPATH_PLUGIN_ID		SetPluginID(EVMS_IBM_OEM_ID,	\
							    EVMS_REGION_MANAGER,\
							    9)
#define EVMS_MD_MULTIPATH_PLUGIN_SHORT_NAME	"MD Multipath"
#define EVMS_MD_MULTIPATH_PLUGIN_LONG_NAME	"MD Multipath Region Manager"

#define EVMS_LVM2_PLUGIN_ID			SetPluginID(EVMS_IBM_OEM_ID,	\
							    EVMS_REGION_MANAGER,\
							    10)
#define EVMS_LVM2_PLUGIN_SHORT_NAME		"LVM2"
#define EVMS_LVM2_PLUGIN_LONG_NAME     		"LVM2 Region Manager"


/***************\
* EVMS Features *
\***************/

#define EVMS_DRIVE_LINK_PLUGIN_ID		SetPluginID(EVMS_IBM_OEM_ID,	\
							    EVMS_FEATURE,	\
							    1)
#define EVMS_DRIVE_LINK_PLUGIN_SHORT_NAME      "DriveLink"
#define EVMS_DRIVE_LINK_PLUGIN_LONG_NAME       "Drive Linking Feature"

#define EVMS_BBR_FEATURE_PLUGIN_ID		SetPluginID(EVMS_IBM_OEM_ID,	\
							    EVMS_FEATURE,	\
							    6)
#define EVMS_BBR_FEATURE_PLUGIN_SHORT_NAME	"BBR"
#define EVMS_BBR_FEATURE_PLUGIN_LONG_NAME	"Bad Block Relocation Feature"

#define EVMS_SNAPSHOT_PLUGIN_ID			SetPluginID(EVMS_IBM_OEM_ID,	\
							    EVMS_ASSOCIATIVE_FEATURE,\
							    104)
#define EVMS_SNAPSHOT_PLUGIN_SHORT_NAME		"Snapshot"
#define EVMS_SNAPSHOT_PLUGIN_LONG_NAME  	"Snapshot Feature"


/******************\
* Cluster Managers *
\******************/

#define EVMS_HA_PLUGIN_ID			SetPluginID(EVMS_IBM_OEM_ID,	\
							    EVMS_CLUSTER_MANAGER_INTERFACE_MODULE,\
							    1)
#define EVMS_HA_PLUGIN_SHORT_NAME		"Linux-HA"
#define EVMS_HA_PLUGIN_LONG_NAME		"Linux-HA Cluster Manager"

#define EVMS_RSCT_PLUGIN_ID			SetPluginID(EVMS_IBM_OEM_ID,	\
							    EVMS_CLUSTER_MANAGER_INTERFACE_MODULE,\
							    2)
#define EVMS_RSCT_PLUGIN_SHORT_NAME		"RSCT"
#define EVMS_RSCT_PLUGIN_LONG_NAME		"Cluster Manager RSCT"

#define EVMS_HB2_PLUGIN_ID			SetPluginID(EVMS_NOVELL_OEM_ID,	\
							    EVMS_CLUSTER_MANAGER_INTERFACE_MODULE,\
							    1)
#define EVMS_HB2_PLUGIN_SHORT_NAME		"Novell-HA"
#define EVMS_HB2_PLUGIN_LONG_NAME		"Novell HA Cluster Manager"

/*******************************\
* File System Interface Modules *
\*******************************/

#define EVMS_JFS_PLUGIN_ID			SetPluginID(EVMS_IBM_OEM_ID,	\
							    EVMS_FILESYSTEM_INTERFACE_MODULE,\
							    6)
#define EVMS_JFS_PLUGIN_SHORT_NAME		"JFS"
#define EVMS_JFS_PLUGIN_LONG_NAME      		"JFS File System Interface Module"

#define EVMS_EXT2_PLUGIN_ID			SetPluginID(EVMS_IBM_OEM_ID,	\
							    EVMS_FILESYSTEM_INTERFACE_MODULE,\
							    7)
#define EVMS_EXT2_PLUGIN_SHORT_NAME		"Ext2/3"
#define EVMS_EXT2_PLUGIN_LONG_NAME     		"Ext2/3 File System Interface Module"

#define EVMS_REISER_PLUGIN_ID			SetPluginID(EVMS_IBM_OEM_ID,	\
							    EVMS_FILESYSTEM_INTERFACE_MODULE,\
							    9)
#define EVMS_REISER_PLUGIN_SHORT_NAME		"ReiserFS"
#define EVMS_REISER_PLUGIN_LONG_NAME   		"ReiserFS File System Interface Module"

#define EVMS_SWAP_PLUGIN_ID			SetPluginID(EVMS_IBM_OEM_ID,	\
							    EVMS_FILESYSTEM_INTERFACE_MODULE,\
							    10)
#define EVMS_SWAP_PLUGIN_SHORT_NAME		"SWAPFS"
#define EVMS_SWAP_PLUGIN_LONG_NAME      	"Swap File System Interface Module"

#define EVMS_NTFS_PLUGIN_ID			SetPluginID(EVMS_IBM_OEM_ID,	\
							    EVMS_FILESYSTEM_INTERFACE_MODULE,\
							    13)
#define EVMS_NTFS_PLUGIN_SHORT_NAME		"NTFS"
#define EVMS_NTFS_PLUGIN_LONG_NAME     		"NTFS File System Interface Module"

#define EVMS_OGFS_PLUGIN_ID			SetPluginID(EVMS_IBM_OEM_ID,	\
							    EVMS_FILESYSTEM_INTERFACE_MODULE,\
							    20)
#define EVMS_OGFS_PLUGIN_SHORT_NAME    		"OGFS"
#define EVMS_OGFS_PLUGIN_LONG_NAME     		"OpenGFS File System Interface Module"

#define EVMS_XFS_PLUGIN_ID			SetPluginID(EVMS_IBM_OEM_ID,	\
							    EVMS_FILESYSTEM_INTERFACE_MODULE,\
							    11)
#define EVMS_XFS_PLUGIN_SHORT_NAME		"XFS"
#define EVMS_XFS_PLUGIN_LONG_NAME       	"XFS File System Interface Module"

#define EVMS_OCFS2_PLUGIN_ID			SetPluginID(EVMS_NOVELL_OEM_ID,    \
							    EVMS_FILESYSTEM_INTERFACE_MODULE, \
							    14)
#define EVMS_OCFS2_PLUGIN_SHORT_NAME		"OCFS2"
#define EVMS_OCFS2_PLUGIN_LONG_NAME		"OCFS2 File System Interface Module"

#define EVMS_FAT_PLUGIN_ID			SetPluginID(EVMS_ALT_LINUX_OEM_ID, \
							    EVMS_FILESYSTEM_INTERFACE_MODULE, \
							    15)
#define EVMS_FAT_PLUGIN_SHORT_NAME		"FAT32"
#define EVMS_FAT_PLUGIN_LONG_NAME		"FAT32 File System Interface Module"

#define EVMS_FAT16_PLUGIN_ID			SetPluginID(EVMS_ALT_LINUX_OEM_ID, \
							    EVMS_FILESYSTEM_INTERFACE_MODULE, \
							    16)
#define EVMS_FAT16_PLUGIN_SHORT_NAME		"FAT16"
#define EVMS_FAT16_PLUGIN_LONG_NAME		"FAT16 File System Interface Module"

#endif
