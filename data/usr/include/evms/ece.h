/*
 *
 *   (C) Copyright IBM Corp. 2002, 2003
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
 * Module: ece.h
 */

#ifndef EVMS_ECE_H_INCLUDED
#define EVMS_ECE_H_INCLUDED 1

#include <stdlib.h>


#define ECE_NODEID_SIZE	128

typedef struct ece_nodeid_s {
	unsigned char bytes[ECE_NODEID_SIZE];
} ece_nodeid_t;

#define ECE_NO_NODE   {bytes:{0}}

#define ECE_ALL_NODES {bytes:{0xff,0xff,0xff,0xff,0xff,0xff,0xff,0xff, \
                              0xff,0xff,0xff,0xff,0xff,0xff,0xff,0xff, \
                              0xff,0xff,0xff,0xff,0xff,0xff,0xff,0xff, \
                              0xff,0xff,0xff,0xff,0xff,0xff,0xff,0xff, \
                              0xff,0xff,0xff,0xff,0xff,0xff,0xff,0xff, \
                              0xff,0xff,0xff,0xff,0xff,0xff,0xff,0xff, \
                              0xff,0xff,0xff,0xff,0xff,0xff,0xff,0xff, \
                              0xff,0xff,0xff,0xff,0xff,0xff,0xff,0xff, \
                              0xff,0xff,0xff,0xff,0xff,0xff,0xff,0xff, \
                              0xff,0xff,0xff,0xff,0xff,0xff,0xff,0xff, \
                              0xff,0xff,0xff,0xff,0xff,0xff,0xff,0xff, \
                              0xff,0xff,0xff,0xff,0xff,0xff,0xff,0xff, \
                              0xff,0xff,0xff,0xff,0xff,0xff,0xff,0xff, \
                              0xff,0xff,0xff,0xff,0xff,0xff,0xff,0xff, \
                              0xff,0xff,0xff,0xff,0xff,0xff,0xff,0xff, \
                              0xff,0xff,0xff,0xff,0xff,0xff,0xff,0xff}}


#define ECE_CLUSTERID_SIZE	128

typedef struct ece_clusterid_s {
	unsigned char bytes[ECE_CLUSTERID_SIZE];
} ece_clusterid_t;


#define ECE_NO_CLUSTER {bytes:{0}}


typedef enum {
	DELTAS,
	FULL_MEMBERSHIP
} ece_callback_type_t;


typedef enum {
	DELTA_JOIN,
	DELTA_LEAVE,
	MEMBERSHIP
} ece_event_type_t;


typedef enum {
	CALLBACK_MEMBERSHIP,
	CALLBACK_MESSAGE
} ece_callback_class_t;


typedef void (*ece_cb_t)(const ece_callback_class_t class,
			 const size_t               size,
			 const void               * data);


typedef struct ece_event_s {
	ece_event_type_t type;
	uint             transid;
	uint             quorum_flag;
	uint             num_entries;
	ece_nodeid_t     node[1];
} ece_event_t;


typedef struct ece_msg_s {
	ece_nodeid_t	node;
	u_int32_t	corrolator;
	u_int32_t	cmd;
	size_t		size;
	void	      * msg;
} ece_msg_t;




#endif
