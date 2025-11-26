import React from 'react';
import { Box, Text, Heading, HStack, Icon } from 'native-base';
import { Feather } from '@expo/vector-icons';

export default function InboxScreen() {
  return (
    <Box w="100%" h="100%" bg="white" px={5} py={5}>
      <Box
        bg="white"
        borderRadius={12}
        p={4}
        borderWidth={1}
        borderColor="brand.lightGray"
      >
        <HStack alignItems="center" space={2} mb={3}>
          <Icon as={Feather} name="mail" size={5} color="brand.blueGray" />
          <Heading fontSize="h2" color="brand.blueGray" fontWeight="600">
            Inbox
          </Heading>
        </HStack>
        <Text fontSize="body" color="brand.mediumGray" fontWeight="400">
          Écran réservé pour l'intégration email et OCR dans un prochain milestone.
        </Text>
      </Box>
    </Box>
  );
}
