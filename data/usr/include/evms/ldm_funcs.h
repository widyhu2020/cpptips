/*
 *
 *   (C) Copyright IBM Corp. 2001, 2003
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
 *   Module: ldm_funcs.h
 *
 */

#include <options.h>

#ifndef EVMS_LDM_FUNCS_H_INCLUDED
#define EVMS_LDM_FUNCS_H_INCLUDED 1

/* Interface definition for Local Disk Manager's plug-in functions */

/*
 * Start caching
 * LDM_Start_Caching does not require an object.
 * The cache is started by default when the Local Disk Manager loads.
 */
#define LDM_Start_Caching (EVMS_Task_Plugin_Function + 1)

/*
 * Stop caching
 * LDM_Stop_Caching does not require an object.
 */
#define LDM_Stop_Caching  (EVMS_Task_Plugin_Function + 2)

/*
 * Open and save a file descriptor for accessing the specified disk.
 * LDM_Open_Disk requires the plug-in function object to be the disk
 * that is to be opened.
 */
#define LDM_Open_Disk     (EVMS_Task_Plugin_Function + 3)

/*
 * Close any open file descriptors being used to access the specified disk.
 * LDM_Close_Disk requires the plug-in function object to be the disk
 * that is to be closed.
 */
#define LDM_Close_Disk    (EVMS_Task_Plugin_Function + 4)


#endif

