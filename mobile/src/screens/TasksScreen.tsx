import React from 'react';
import { Box, Text, Heading, HStack, Icon } from 'native-base';
import { Feather } from '@expo/vector-icons';

export default function TasksScreen() {
  return (
    <Box flex={1} bg="white" px={5} py={5}>
      <Box
        bg="white"
        borderRadius={12}
        p={4}
        borderWidth={1}
        borderColor="brand.lightGray"
      >
        <HStack alignItems="center" space={2} mb={3}>
          <Icon as={Feather} name="list" size={5} color="brand.blueGray" />
          <Heading fontSize="h2" color="brand.blueGray" fontWeight="600">
            Tâches
          </Heading>
        </HStack>
        <Text fontSize="body" color="brand.mediumGray" fontWeight="400">
          Écran à compléter dans un prochain milestone. Pour l'instant, les tâches s'affichent
          uniquement sur l'accueil.
        </Text>
      </Box>
    </Box>
  );
}
